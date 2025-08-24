package com.batr.log.admin

import kotlinx.serialization.Serializable
import org.jetbrains.exposed.dao.id.IntIdTable

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
    WARN,
    ERROR
}

@Serializable
data class AdminLog(
    val type: AdminLogType,
    val message: String,
    val time: Long,
)

object AdminLogTable : IntIdTable() {
    val type = enumeration<AdminLogType>("type")
    val time = long("time")
    val message = text("message")
}