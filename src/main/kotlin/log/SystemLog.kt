package com.batr.log

import com.batr.database.Database.suspendTransaction
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.Query
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction

@Serializable
enum class SystemLogType {
    SYSTEM_START,
    SYSTEM_STOP,
    DOOR,
    RECOGNIZE,
    SETTINGS_CHANGE,
    BACKUP_CREATE,
    BACKUP_DELETE,
    BACKUP_UPLOAD,
    FRAME_ADD,
    FRAME_REMOVE,
    HUMAN_ADD,
    HUMAN_REMOVE,
    FORM_CREATE,
    FORM_DELETE,
    FORM_UPLOAD,
    FORM_ANSWER_ADD,
    FORM_ANSWER_REMOVE,
    WARN,
    ERROR
}

@Serializable
data class SystemLog(
    override val type: SystemLogType,
    override val time: Long,
    override val message: String
) : LogModel<SystemLogType>()

object SystemLogTable : LogTable<SystemLogType>(SystemLogType::class)

object SystemLogService :
    LogService<SystemLogType, SystemLog, SystemLogTable>(SystemLogTable, ::enumValueOf) {
    override fun Query.toModel(): List<SystemLog> = map {
        SystemLog(
            type = it[SystemLogTable.type],
            time = it[SystemLogTable.time],
            message = it[SystemLogTable.message]
        )
    }

    suspend fun log(type: SystemLogType, message: String, time: Long = System.currentTimeMillis()): Unit = suspendTransaction {
        table.insert {
            it[table.type] = type
            it[table.time] = time
            it[table.message] = message
        }
    }

    fun logB(type: SystemLogType, message: String, time: Long = System.currentTimeMillis()): Unit = transaction {
        table.insert {
            it[table.type] = type
            it[table.time] = time
            it[table.message] = message
        }
    }

}