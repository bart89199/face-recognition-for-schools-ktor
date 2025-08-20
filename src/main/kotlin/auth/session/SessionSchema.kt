package com.batr.auth.session

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.json.json

@Serializable
data class GoogleAccess(
    val accessToken: String,
    val expiresAt: Long,
    val refreshToken: String? = null,
)

@Serializable
data class UserSession(
    val userId: Int,
    val token: String,
    val expiresAt: Long,
    val googleAccess: GoogleAccess? = null,
)

@Serializable
data class CookieUserSession(
    val token: String
)

object SessionTable: IntIdTable() {
    val userId = integer("user_id")
    val token = varchar("token", 300).uniqueIndex()
    val expiresAt = long("expires_at")
    val googleAccess = json<GoogleAccess>("google_access", Json.Default).nullable()
}