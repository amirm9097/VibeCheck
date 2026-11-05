from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "display_name", "role", "date_joined")
        read_only_fields = fields

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)
    class Meta:
        model = User
        fields = ("email", "display_name", "password", "password_confirm")
        extra_kwargs = {"display_name": {"required": False, "allow_blank": True}}
    def validate_email(self, value):
        return value.strip().lower()
    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs
    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)
