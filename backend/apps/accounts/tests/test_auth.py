from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User

class AuthenticationTests(TestCase):
    def test_email_user_manager_hashes_password(self):
        user = User.objects.create_user("Analyst@Example.com", "long-password!123")
        self.assertEqual(user.email, "analyst@example.com")
        self.assertTrue(user.check_password("long-password!123"))
        self.assertFalse(user.check_password("wrong"))

    def test_registration_does_not_allow_role_escalation(self):
        client = APIClient()
        response = client.post("/api/v1/auth/register/", {
            "email": "new@example.com", "display_name": "New Analyst",
            "password": "a-very-long-password-123", "password_confirm": "a-very-long-password-123",
            "role": "admin",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="new@example.com")
        self.assertEqual(user.role, User.Role.USER)
        self.assertFalse(user.is_staff)
