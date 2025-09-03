package com.batr.log

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.database.Database.suspendTransaction
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.util.reflect.typeInfo
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.Query
import org.jetbrains.exposed.sql.Transaction
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction

@Serializable
enum class AdminLogType {
    USER_LOGIN,
    USER_LOGOUT,
    USER_CREATED,
    USER_UPDATE,
    USER_DELETE,
    SESSION_DELETE,
    LOGS_DOWNLOAD,
    RECORD_DOWNLOAD,
    SETTINGS_CHANGE,
    FORCE_DOOR,
    BACKUP_CREATE,
    BACKUP_DELETE,
    BACKUP_UPLOAD,
    FORM_CREATE,
    FORM_UPLOAD,
    FORM_DELETE,
    FRAME_ADD,
    FRAME_REMOVE,
    HUMAN_ADD,
    HUMAN_REMOVE,
    INFO,
    WARN,
    ERROR
}

@Serializable
data class AdminLog(
    override val type: AdminLogType,
    override val time: Long,
    override val message: String,
    val sessionId: Int
) : LogModel<AdminLogType>() {
    override fun toString(): String {
        return "[${time.toDateString()}] [$type] [session: $sessionId]: $message"
    }
}

object AdminLogTable : LogTable<AdminLogType>(AdminLogType::class) {
    val sessionId = integer("session_id")
}

object AdminLogService :
    LogService<AdminLogType, AdminLog, AdminLogTable>(AdminLogTable) {
    override fun Query.toModel(): List<AdminLog> = map {
        AdminLog(
            type = it[AdminLogTable.type],
            time = it[AdminLogTable.time],
            message = it[AdminLogTable.message],
            sessionId = it[AdminLogTable.sessionId]
        )
    }

    fun configureRouting(app: Application) = app.routing {
        route("api/logs/admin") {
            authenticate("session-auth") {
                setPermissions(UserPermissions(admin = true)) {
                    configureLogManagers(this)
                }
            }
        }
    }

    private fun Transaction.addLog(
        type: AdminLogType,
        message: String,
        sessionId: Int,
        time: Long
    ) {
        table.insert {
            it[table.type] = type
            it[table.time] = time
            it[table.message] = message
            it[table.sessionId] = sessionId
        }
    }

    suspend fun log(
        type: AdminLogType,
        message: String,
        sessionId: Int,
        time: Long = System.currentTimeMillis()
    ): Unit {
        suspendTransaction {
            addLog(type, message, sessionId, time)
        }
        addLog(AdminLog(type, time, message, sessionId))
    }

    fun logB(type: AdminLogType, message: String, sessionId: Int, time: Long = System.currentTimeMillis()): Unit {
        transaction {
            addLog(type, message, sessionId, time)
        }
        runBlocking {
            addLog(AdminLog(type, time, message, sessionId))
        }
    }
}