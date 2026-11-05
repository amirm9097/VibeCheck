"""Fail-closed URL validation used before enqueue and again for browser requests.

The egress proxy resolves names and pins the TCP connection to a validated public IP,
which closes the DNS-rebinding gap between validation and connection establishment.
"""
import ipaddress
import socket
from urllib.parse import urlsplit, urlunsplit
from django.core.exceptions import ValidationError

BLOCKED_SUFFIXES = (".localhost", ".local", ".internal", ".lan", ".home", ".test", ".invalid")
ALLOWED_PORTS = {80, 443}

def public_addresses(host: str, port: int):
    try:
        literal = ipaddress.ip_address(host.strip("[]"))
        addresses = [literal]
    except ValueError:
        try:
            infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise ValidationError({"url": "The hostname could not be resolved."}) from exc
        addresses = []
        for item in infos:
            try:
                addresses.append(ipaddress.ip_address(item[4][0].split("%", 1)[0]))
            except ValueError:
                continue
    if not addresses:
        raise ValidationError({"url": "The hostname did not resolve to an IP address."})
    if any(not addr.is_global for addr in addresses):
        raise ValidationError({"url": "This URL resolves to a private, reserved, or non-public network address."})
    return addresses

def validate_public_url(value: str, *, resolve: bool = True) -> str:
    if not isinstance(value, str) or len(value) > 2048:
        raise ValidationError({"url": "Enter a valid public website URL (maximum 2048 characters)."})
    raw = value.strip()
    if not raw:
        raise ValidationError({"url": "A website URL is required."})
    if "://" not in raw:
        raw = "https://" + raw
    try:
        parts = urlsplit(raw)
        explicit_port = parts.port
        port = explicit_port if explicit_port is not None else (443 if parts.scheme.lower() == "https" else 80)
    except ValueError as exc:
        raise ValidationError({"url": "The URL is malformed."}) from exc
    scheme = parts.scheme.lower()
    host = (parts.hostname or "").rstrip(".").lower()
    if scheme not in {"http", "https"}:
        raise ValidationError({"url": "Only HTTP and HTTPS websites can be analyzed."})
    if not host or parts.username or parts.password:
        raise ValidationError({"url": "The URL must include a hostname and cannot contain credentials."})
    expected_port = 443 if scheme == "https" else 80
    if port != expected_port:
        raise ValidationError({"url": "Use the standard port for the selected scheme: HTTP 80 or HTTPS 443."})
    if host == "localhost" or host.endswith(BLOCKED_SUFFIXES):
        raise ValidationError({"url": "Local and internal hostnames cannot be analyzed."})
    try:
        literal_ip = ipaddress.ip_address(host)
        if not literal_ip.is_global:
            raise ValidationError({"url": "Private, reserved, and non-public IP addresses cannot be analyzed."})
    except ValueError:
        pass
    if resolve:
        public_addresses(host, port)
    netloc = f"[{host}]" if ":" in host else host
    path = parts.path or "/"
    return urlunsplit((scheme, netloc, path, parts.query, ""))
