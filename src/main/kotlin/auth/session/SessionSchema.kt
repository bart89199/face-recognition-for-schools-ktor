package com.batr.auth.session

import kotlinx.serialization.SerialName
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
data class RequestData(
    @SerialName("login_time") val loginTime: Long,
    val ip: String,
    @SerialName("user_agent") val userAgent: String?,
    )

@Serializable
data class UserSession(
    val id: Int,
    val active: Boolean,
    @SerialName("user_id") val userId: Int,
    val token: String,
    @SerialName("expires_at") val expiresAt: Long,
    @SerialName("request_data") val requestData: RequestData,
    @SerialName("google_access") val googleAccess: GoogleAccess? = null,
)

@Serializable
data class CookieUserSession(
    val token: String
)

object SessionTable : IntIdTable() {
    val userId = integer("user_id")
    val active = bool("active")
    val token = varchar("token", 300).uniqueIndex()
    val expiresAt = long("expires_at")
    val requestData = json<RequestData>("request_data", Json.Default)
    val googleAccess = json<GoogleAccess>("google_access", Json.Default).nullable()
}