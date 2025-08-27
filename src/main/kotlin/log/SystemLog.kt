package com.batr.log

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.database.Database.suspendTransaction
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.util.reflect.typeInfo
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.Query
import org.jetbrains.exposed.sql.Transaction
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
) : LogModel<SystemLogType>() {
    override fun toString(): String {
        return super.toString()
    }
}

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

    fun configureRouting(app: Application) = app.routing {
        route("api/logs/system") {
            authenticate("session-auth") {
                setPermissions(UserPermissions(logs = true)) {
                    configureLogManagers(typeInfo<List<SystemLog>>())
                }
            }
        }
    }

    private fun Transaction.addLog(type: SystemLogType, message: String, time: Long) {
        table.insert {
            it[table.type] = type
            it[table.time] = time
            it[table.message] = message
        }
        addLog(SystemLog(type, time, message))
    }

    suspend fun log(type: SystemLogType, message: String, time: Long = System.currentTimeMillis()): Unit =
        suspendTransaction {
            addLog(type, message, time)
        }

    fun logB(type: SystemLogType, message: String, time: Long = System.currentTimeMillis()): Unit = transaction {
        addLog(type, message, time)
    }

}