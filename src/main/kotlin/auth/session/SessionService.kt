package com.batr.auth.session

import com.batr.auth.TokenGenerator
import com.batr.auth.user.UserService
import com.batr.database.Database.suspendTransaction
import io.ktor.server.application.*
import io.ktor.server.config.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import kotlin.properties.Delegates

object SessionService {
    var tokenLifeTimeMs by Delegates.notNull<Long>()
        private set

    fun load(application: Application) {
        tokenLifeTimeMs = application.environment.config.property("auth.token-life-time-ms").getAs()
        transaction {
            SchemaUtils.create(SessionTable)
        }
    }

    private fun Query.toModel() = map {
        UserSession(
            it[SessionTable.userId],
            it[SessionTable.token],
            it[SessionTable.expiresAt],
            it[SessionTable.googleAccess]
        )
    }

    suspend fun create(userId: Int, expiresIn: Long = tokenLifeTimeMs, googleAccess: GoogleAccess? = null) =
        suspendTransaction {
            val expiresAt = expiresIn + System.currentTimeMillis()
            val token = TokenGenerator.generateSessionToken()
            SessionTable.insert {
                it[SessionTable.userId] = userId
                it[SessionTable.token] = token
                it[SessionTable.expiresAt] = expiresAt
                it[SessionTable.googleAccess] = googleAccess
            }
            UserSession(userId, token, expiresAt, googleAccess)
        }


    suspend fun get(token: String) = suspendTransaction {
        SessionTable.selectAll().where { SessionTable.token eq token }.toModel().firstOrNull()
    }

    suspend fun delete(token: String) = suspendTransaction {
        SessionTable.deleteWhere { SessionTable.token eq token } == 1
    }
}

suspend fun UserSession.delete() = SessionService.delete(token)

suspend fun CookieUserSession.getSession() = SessionService.get(token)
suspend fun UserSession.getUserOrNull() = UserService.getById(userId)
suspend fun UserSession.getUser() = getUserOrNull() ?: throw IllegalArgumentException("session user does not exist")
suspend fun CookieUserSession.delete() = SessionService.delete(token)
suspend fun UserSession?.check() = this?.getUserOrNull() != null
suspend fun CookieUserSession?.check() = this?.getSession()?.getUserOrNull() != null