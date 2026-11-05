"""Minimal fail-closed HTTP CONNECT proxy for isolated site inspections.

The proxy resolves a hostname once, rejects every non-global address, and opens
its socket to the validated IP (not the hostname), preventing DNS-rebinding
between validation and the actual outbound connection.
"""
import asyncio
import ipaddress
import logging
import socket
from urllib.parse import urlsplit

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s egress %(message)s")
log = logging.getLogger("egress")
MAX_HEADER = 64 * 1024
MAX_TRANSFER = 100 * 1024 * 1024
ALLOWED = {80, 443}
CONCURRENCY = asyncio.Semaphore(80)


async def resolve_public_addresses(host: str, port: int):
    host = host.strip("[]").rstrip(".").lower()

    if (
        not host
        or host in {"localhost", "localhost.localdomain"}
        or host.endswith((
            ".local", ".internal", ".lan",
            ".home", ".localhost", ".test", ".invalid"
        ))
    ):
        raise ValueError("internal hostname")

    try:
        ip = ipaddress.ip_address(host)
        addresses = [ip]
    except ValueError:
        loop = asyncio.get_running_loop()
        infos = await asyncio.wait_for(
    loop.getaddrinfo(
        host,
        port,
        family=socket.AF_INET,
        type=socket.SOCK_STREAM
    ),
    timeout=5
)
        addresses = []

        for info in infos:
            try:
                address = ipaddress.ip_address(
                    info[4][0].split("%", 1)[0]
                )
                if address not in addresses:
                    addresses.append(address)
            except ValueError:
                continue

    # Fail closed: never allow a hostname with mixed public/private answers.
    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("non-public address")

    # Prefer IPv4 because this Docker environment has no IPv6 route.
    addresses.sort(key=lambda address: address.version != 4)

    return addresses


async def resolve_public(host: str, port: int):
    addresses = await resolve_public_addresses(host, port)
    return str(addresses[0])


async def connect_public(host: str, port: int):
    addresses = await resolve_public_addresses(host, port)
    failures = []

    for address in addresses:
        try:
            return await asyncio.wait_for(
                asyncio.open_connection(str(address), port),
                timeout=3
            )
        except (OSError, asyncio.TimeoutError) as exc:
            failures.append(
                f"{address}: {type(exc).__name__}"
            )

    raise OSError(
        "All validated public IPs failed: " + ", ".join(failures[:8])
    )


async def read_headers(reader):
    data = bytearray()
    while not data.endswith(b"\r\n\r\n"):
        chunk = await asyncio.wait_for(reader.read(1), timeout=8)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > MAX_HEADER:
            raise ValueError("header too large")
    return bytes(data)

async def relay(reader, writer):
    transferred = 0
    while True:
        chunk = await asyncio.wait_for(reader.read(65536), timeout=75)
        if not chunk:
            break
        transferred += len(chunk)
        if transferred > MAX_TRANSFER:
            break
        writer.write(chunk)
        await writer.drain()

async def pipe(reader, writer):
    try:
        await relay(reader, writer)
    except (asyncio.TimeoutError, ConnectionError, OSError):
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

async def handle(client_reader, client_writer):
    peer = client_writer.get_extra_info("peername")
    async with CONCURRENCY:
        upstream_writer = None
        try:
            line = await asyncio.wait_for(client_reader.readline(), timeout=8)
            if not line:
                return
            if len(line) > 8192:
                raise ValueError("request line too large")
            try:
                method, target, version = line.decode("ascii").strip().split(" ", 2)
            except (ValueError, UnicodeDecodeError) as exc:
                raise ValueError("malformed request line") from exc
            if version not in {"HTTP/1.0", "HTTP/1.1"}:
                raise ValueError("unsupported HTTP version")
            header_blob = await read_headers(client_reader)
            if not header_blob.endswith(b"\r\n\r\n"):
                raise ValueError("incomplete request headers")
            header_lines = header_blob.split(b"\r\n")[:-2]
            if method.upper() == "CONNECT":
                if ":" not in target:
                    raise ValueError("missing CONNECT port")
                host, port_text = target.rsplit(":", 1)
                port = int(port_text)
                if port != 443:
                    raise ValueError("CONNECT port denied")
                ip = await resolve_public(host, port)
                upstream_reader, upstream_writer = await connect_public(host, port)
                client_writer.write(b"HTTP/1.1 200 Connection Established\r\nProxy-Agent: VibeCheck-Egress\r\n\r\n")
                await client_writer.drain()
                # Tunnel both directions; the browser performs TLS end-to-end.
                a = asyncio.create_task(pipe(client_reader, upstream_writer))
                b = asyncio.create_task(pipe(upstream_reader, client_writer))
                await asyncio.gather(a, b)
                upstream_writer = None
                return
            if method.upper() not in {"GET", "HEAD"}:
                raise ValueError("only GET and HEAD are permitted by the inspection proxy")
            parsed = urlsplit(target)
            if parsed.scheme != "http" or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("only absolute HTTP proxy URLs without credentials are supported")
            explicit_port = parsed.port
            port = explicit_port if explicit_port is not None else 80
            if port != 80:
                raise ValueError("HTTP port denied")
            upstream_reader, upstream_writer = await connect_public(parsed.hostname, port)
            path = parsed.path or "/"
            if parsed.query:
                path += "?" + parsed.query
            clean_headers = []
            for raw in header_lines:
                if not raw:
                    continue
                lower = raw.lower()
                if lower.startswith((b"host:", b"proxy-connection:", b"connection:", b"proxy-authorization:")):
                    continue
                clean_headers.append(raw)
            host = parsed.hostname
            if ":" in host:
                host = f"[{host}]"
            host_header = host if explicit_port is None else f"{host}:{explicit_port}"
            clean_headers.append(f"Host: {host_header}".encode("ascii"))
            clean_headers.append(b"Connection: close")
            request = f"{method} {path} {version}\r\n".encode("ascii") + b"\r\n".join(clean_headers) + b"\r\n\r\n"
            upstream_writer.write(request)
            await upstream_writer.drain()
            await relay(upstream_reader, client_writer)
        except Exception as exc:
            log.info("blocked/failed peer=%s reason=%s", peer, str(exc)[:160])
            try:
                client_writer.write(b"HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
                await client_writer.drain()
            except Exception:
                pass
        finally:
            if upstream_writer:
                try:
                    upstream_writer.close()
                    await upstream_writer.wait_closed()
                except Exception:
                    pass
            try:
                client_writer.close()
                await client_writer.wait_closed()
            except Exception:
                pass

async def main():
    server = await asyncio.start_server(handle, "0.0.0.0", 8888, limit=MAX_HEADER)
    log.info("SSRF-safe egress proxy listening on :8888")
    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    asyncio.run(main())
