"""Offline unit tests for the proxy's public-address decision boundary."""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import proxy


class ResolvePublicTests(unittest.IsolatedAsyncioTestCase):
    async def test_rejects_loopback_literal(self):
        with self.assertRaises(ValueError):
            await proxy.resolve_public("127.0.0.1", 443)

    async def test_rejects_internal_names_before_dns(self):
        with self.assertRaises(ValueError):
            await proxy.resolve_public("database.internal", 443)

    async def test_rejects_mixed_public_and_private_dns_answers(self):
        loop = SimpleNamespace(getaddrinfo=AsyncMock(return_value=[
            (None, None, None, None, ("93.184.216.34", 443)),
            (None, None, None, None, ("10.10.0.8", 443)),
        ]))
        with patch.object(asyncio, "get_running_loop", return_value=loop):
            with self.assertRaises(ValueError):
                await proxy.resolve_public("mixed.example", 443)

    async def test_returns_a_verified_public_ip_for_pinned_connection(self):
        loop = SimpleNamespace(getaddrinfo=AsyncMock(return_value=[
            (None, None, None, None, ("93.184.216.34", 443)),
        ]))
        with patch.object(asyncio, "get_running_loop", return_value=loop):
            result = await proxy.resolve_public("example.com", 443)
        self.assertEqual(result, "93.184.216.34")
        loop.getaddrinfo.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
