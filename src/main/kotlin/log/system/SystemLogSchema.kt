package com.batr.log.system

import kotlinx.serialization.Serializable
import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.sql.kotlin.datetime.time

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
    val type: SystemLogType,
    val message: String,
    val time: Long,
)

object SystemLogTable : IntIdTable() {
    val type = enumeration<SystemLogType>("type")
    val time = long("time")
    val message = text("message")
}