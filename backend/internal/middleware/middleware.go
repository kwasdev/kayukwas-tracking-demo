package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/kayukwas/tracking-backend/internal/models"
	"github.com/kayukwas/tracking-backend/internal/utils"
)

// AuthMiddleware validates JWT in Authorization: Bearer <token>
func AuthMiddleware(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.JSONError(c, fiber.StatusUnauthorized, "Token autentikasi diperlukan", nil)
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return utils.JSONError(c, fiber.StatusUnauthorized, "Format token autentikasi tidak valid (Gunakan: Bearer <token>)", nil)
		}

		tokenString := parts[1]
		claims, err := utils.ValidateJWT(jwtSecret, tokenString)
		if err != nil {
			return utils.JSONError(c, fiber.StatusUnauthorized, "Token autentikasi tidak valid atau sudah kadaluarsa", err.Error())
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("name", claims.Name)
		c.Locals("roles", claims.Roles)
		c.Locals("permissions", claims.Permissions)
		c.Locals("claims", claims)

		return c.Next()
	}
}

// RequirePermission checks if the authenticated user has the given permission or is Superuser
func RequirePermission(permissionName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		roles, _ := c.Locals("roles").([]string)
		permissions, _ := c.Locals("permissions").([]string)

		// 1. Superuser Bypass
		for _, r := range roles {
			if r == models.RoleSuperuser {
				return c.Next()
			}
		}

		// 2. Union Permissions Check
		for _, p := range permissions {
			if p == permissionName {
				return c.Next()
			}
		}

		return utils.JSONError(c, fiber.StatusForbidden, "Akses ditolak: Anda tidak memiliki hak akses '"+permissionName+"'", nil)
	}
}

// RequireSuperuser ensures only Superuser role can access the endpoint
func RequireSuperuser() fiber.Handler {
	return func(c *fiber.Ctx) error {
		roles, _ := c.Locals("roles").([]string)
		for _, r := range roles {
			if r == models.RoleSuperuser {
				return c.Next()
			}
		}
		return utils.JSONError(c, fiber.StatusForbidden, "Akses ditolak: Tindakan ini hanya dapat dilakukan oleh Superuser", nil)
	}
}

// OpenWASignatureMiddleware verifies HMAC-SHA256 signature from OpenWA Gateway if present
func OpenWASignatureMiddleware(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		signature := c.Get("X-OpenWA-Signature")
		if signature == "" || secret == "" {
			return c.Next() // Bypass if no signature provided by gateway or no secret configured
		}

		rawBody := c.Body()
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(rawBody)
		expectedSignature := "sha256=" + hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
			return utils.JSONError(c, fiber.StatusUnauthorized, "Invalid OpenWA webhook signature", nil)
		}

		return c.Next()
	}
}
