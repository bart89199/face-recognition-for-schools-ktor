package com.batr.log

import com.batr.database.Database.suspendTransaction
import io.ktor.server.application.Application
import io.ktor.util.reflect.typeInfo
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.Query
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
    DOOR,
    LOGS_DOWNLOAD,
    RECORD_DOWNLOAD,
    SETTINGS_CHANGE,
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
}

@Serializable
data class AdminLog(
    override val type: AdminLogType,
    override val time: Long,
    override val message: String,
    val sessionId: Int
) : LogModel<AdminLogType>()

object AdminLogTable : LogTable<AdminLogType>(AdminLogType::class) {
    val sessionId = integer("session_id")
}

object AdminLogService :
    LogService<AdminLogType, AdminLog, AdminLogTable>(AdminLogTable, ::enumValueOf) {
    override fun Query.toModel(): List<AdminLog> = map {
        AdminLog(
            type = it[AdminLogTable.type],
            time = it[AdminLogTable.time],
            message = it[AdminLogTable.message],
            sessionId = it[AdminLogTable.sessionId]
        )
    }

    fun configureRouting(app: Application) = app.configureLogManagers("api/logs/admin", typeInfo<List<AdminLog>>())

    suspend fun log(type: AdminLogType, message: String, sessionId: Int, time: Long = System.currentTimeMillis()): Unit = suspendTransaction {
        table.insert {
            it[table.type] = type
            it[table.time] = time
            it[table.message] = message
            it[table.sessionId] = sessionId
        }
    }

    fun logB(type: AdminLogType, message: String, sessionId: Int, time: Long = System.currentTimeMillis()): Unit = transaction {
        table.insert {
            it[table.type] = type
            it[table.time] = time
            it[table.message] = message
            it[table.sessionId] = sessionId
        }
    }
}