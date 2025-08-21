package com.batr.auth.session

import com.batr.auth.TokenGenerator
import com.batr.auth.user.User
import com.batr.auth.user.UserService
import com.batr.database.Database.suspendTransaction
import io.ktor.server.application.*
import io.ktor.server.config.*
import io.ktor.server.plugins.origin
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
            it[SessionTable.id].value,
            it[SessionTable.userId],
            it[SessionTable.token],
            it[SessionTable.expiresAt],
            it[SessionTable.requestData],
            it[SessionTable.googleAccess]
        )
    }

    suspend fun create(userId: Int, requestData: RequestData, expiresIn: Long = tokenLifeTimeMs, googleAccess: GoogleAccess? = null) =
        suspendTransaction {
            val expiresAt = expiresIn + System.currentTimeMillis()
            val token = TokenGenerator.generateSessionToken()
            val id = SessionTable.insert {
                it[SessionTable.userId] = userId
                it[SessionTable.token] = token
                it[SessionTable.expiresAt] = expiresAt
                it[SessionTable.requestData] = requestData
                it[SessionTable.googleAccess] = googleAccess
            }[SessionTable.id].value
            UserSession(id, userId, token, expiresAt, requestData, googleAccess)
        }


    suspend fun getById(id: Int) = suspendTransaction {
        SessionTable.selectAll().where { SessionTable.id eq id }.toModel().firstOrNull()
    }

    suspend fun getByToken(token: String) = suspendTransaction {
        SessionTable.selectAll().where { SessionTable.token eq token }.toModel().firstOrNull()
    }

    suspend fun deleteById(id: Int) = suspendTransaction {
        SessionTable.deleteWhere { SessionTable.id eq id } == 1
    }

    suspend fun deleteByToken(token: String) = suspendTransaction {
        SessionTable.deleteWhere { SessionTable.token eq token } == 1
    }

    suspend fun removeAllUserSessions(id: Int) = suspendTransaction {
        SessionTable.deleteWhere { SessionTable.userId eq id }
    }

    suspend fun getUserSessions(id: Int) = suspendTransaction {
        SessionTable.selectAll().where(SessionTable.userId eq id).toModel()
    }
}

suspend fun UserSession.delete() = SessionService.deleteByToken(token)

suspend fun CookieUserSession.getSession() = SessionService.getByToken(token)

suspend fun UserSession.getUserOrNull() = UserService.getById(userId)

suspend fun UserSession.getUser() = getUserOrNull() ?: throw IllegalArgumentException("session user does not exist")

suspend fun CookieUserSession.delete() = SessionService.deleteByToken(token)

suspend fun UserSession?.check() = this?.getUserOrNull() != null

suspend fun CookieUserSession?.check() = this?.getSession()?.getUserOrNull() != null

suspend fun User.removeAllSessions() = SessionService.removeAllUserSessions(id)

suspend fun UserSession.removeAllSessions() = SessionService.removeAllUserSessions(userId)

suspend fun User.getAllSessions() = SessionService.getUserSessions(id)

suspend fun UserSession.getAllSessions() = SessionService.getUserSessions(userId)

fun ApplicationCall.getRequestData() =
    RequestData(System.currentTimeMillis(), request.origin.remoteAddress, request.headers["User-Agent"])