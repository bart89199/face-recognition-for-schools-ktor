package com.batr.auth.user

import com.batr.auth.session.GoogleAccess
import com.batr.auth.session.SessionService
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.json.json

@Serializable
data class UserPermissions(
    val stream: Boolean = false,
    @SerialName("door_control") val doorControl: Boolean = false,
    val status: Boolean = false,
    val logs: Boolean = false,
    val records: Boolean = false,
    val manual: Boolean = false,
    val settings: Boolean = false,
    val backup: Boolean = false,
    @SerialName("access_control") val accessControl: Boolean = false,
)

object UserTable : IntIdTable() {
    val name = varchar("name", 100)
    val email = varchar("email", 100).uniqueIndex()
    val password = varchar("password", 300)
    val permissions = json<UserPermissions>("permissions", Json.Default)
}

@Serializable
data class User(
    val id: Int,
    val name: String,
    val email: String,
    val password: String,
    val permissions: UserPermissions,
)

val DEFAULT_PERMISSIONS = UserPermissions()

@Serializable
data class RawUser(
    val name: String,
    val email: String,
    val password: String,
    val permissions: UserPermissions = DEFAULT_PERMISSIONS,
)

fun User.toRaw() = RawUser(name, email, password, permissions)
suspend fun User.newSession(googleAccess: GoogleAccess? = null) = SessionService.create(id, googleAccess = googleAccess)