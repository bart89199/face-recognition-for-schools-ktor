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
    var longTokenLifeTimeMs by Delegates.notNull<Long>()
        private set

    fun load(application: Application): Unit {
        tokenLifeTimeMs = application.environment.config.property("auth.token-life-time-ms").getAs()
        longTokenLifeTimeMs = application.environment.config.property("auth.long-token-life-time-ms").getAs()
        transaction {
            SchemaUtils.create(SessionTable)
        }
    }

    private fun Query.toModel(): List<UserSession> = map {
        UserSession(
            it[SessionTable.id].value,
            it[SessionTable.active],
            it[SessionTable.userId],
            it[SessionTable.token],
            it[SessionTable.expiresAt],
            it[SessionTable.requestData],
            it[SessionTable.googleAccess]
        )
    }

    suspend fun create(
        userId: Int,
        requestData: RequestData,
        expiresIn: Long = tokenLifeTimeMs,
        googleAccess: GoogleAccess? = null
    ): UserSession =
        suspendTransaction {
            val expiresAt = expiresIn + System.currentTimeMillis()
            val token = TokenGenerator.generateSessionToken()
            val id = SessionTable.insert {
                it[SessionTable.userId] = userId
                it[SessionTable.active] = true
                it[SessionTable.token] = token
                it[SessionTable.expiresAt] = expiresAt
                it[SessionTable.requestData] = requestData
                it[SessionTable.googleAccess] = googleAccess
            }[SessionTable.id].value
            UserSession(id, true, userId, token, expiresAt, requestData, googleAccess)
        }

    suspend fun create(
        userId: Int,
        requestData: RequestData,
        longLogin: Boolean,
        googleAccess: GoogleAccess? = null
    ): UserSession = create(
        userId,
        requestData,
        if (longLogin) longTokenLifeTimeMs else tokenLifeTimeMs,
        googleAccess
    )

    private fun active(active: Boolean?): Op<Boolean> =
        if (active != null) SessionTable.active eq active else Op.TRUE

    private fun Iterable<UserSession>.active(active: Boolean?): List<UserSession> =
        filter { if (active != null) it.active == active else true }

    suspend fun getAll(active: Boolean?): List<UserSession> = suspendTransaction {
        SessionTable.selectAll().where { active(active) }.toModel()
    }.update().active(active)

    suspend fun getById(id: Int): UserSession? = suspendTransaction {
        SessionTable.selectAll().where { SessionTable.id eq id }.toModel().firstOrNull()
    }?.update()

    suspend fun getByToken(token: String): UserSession? = suspendTransaction {
        SessionTable.selectAll().where { SessionTable.token eq token }.toModel().firstOrNull()
    }?.update()

    suspend fun getUserSessions(id: Int, active: Boolean?): List<UserSession> = suspendTransaction {
        SessionTable.selectAll().where((SessionTable.userId eq id) and active(active)).toModel()
    }.update().active(active)

    suspend fun deleteById(id: Int): Boolean = suspendTransaction {
        SessionTable.update({ SessionTable.id eq id }) {
            it[SessionTable.active] = false
        } == 1
    }

    suspend fun deleteAll(): Int = suspendTransaction {
        SessionTable.update({ SessionTable.active eq true }) {
            it[SessionTable.active] = false
        }
    }

    suspend fun deleteByUserId(userId: Int): Int = suspendTransaction {
        SessionTable.update({ (SessionTable.userId eq userId) and (SessionTable.active eq true) }) {
            it[SessionTable.active] = false
        }
    }

    suspend fun deleteByToken(token: String): Boolean = suspendTransaction {
        SessionTable.update({ SessionTable.token eq token }) {
            it[SessionTable.active] = false
        } == 1
    }

}

suspend fun UserSession.delete(): Boolean = SessionService.deleteByToken(token)

suspend fun CookieUserSession.getSession(): UserSession? = SessionService.getByToken(token)

suspend fun UserSession.getUserOrNull(): User? = UserService.getById(userId)

suspend fun UserSession.getUser(): User = getUserOrNull() ?: throw IllegalArgumentException("session user does not exist")

suspend fun CookieUserSession.delete(): Boolean = SessionService.deleteByToken(token)

suspend fun UserSession.check(autoUpdate: Boolean = true): Boolean {
    if (autoUpdate) return update().active
    return this.active
}

suspend fun UserSession.update(): UserSession {
    if (!this.active) return this
    if (this.getUserOrNull() == null || this.expiresAt < System.currentTimeMillis()) {
        delete()
        return copy(active = false)
    }
    return this
}

suspend fun Iterable<UserSession>.update(): List<UserSession> = map { it.update() }
suspend fun CookieUserSession.check(): Boolean = this.getSession()?.check() == true

suspend fun User.removeAllSessions(): Int = SessionService.deleteByUserId(id)

suspend fun UserSession.removeAllUserSessions(): Int = SessionService.deleteByUserId(userId)

suspend fun User.getAllSessions(active: Boolean?): List<UserSession> = SessionService.getUserSessions(id, active)

suspend fun UserSession.getAllUserSessions(active: Boolean?): List<UserSession> = SessionService.getUserSessions(userId, active)

fun ApplicationCall.getRequestData(): RequestData =
    RequestData(System.currentTimeMillis(), request.origin.remoteAddress, request.headers["User-Agent"])