package com.batr.log

import com.batr.auth.session.UserSession
import io.ktor.server.application.Application
import kotlin.properties.Delegates

var currentLogAmount: Int by Delegates.notNull()
    private set

fun Application.loadLogConst() {
    currentLogAmount = environment.config.property("log.currentLogAmount").getString().toInt()
}

suspend fun sysLog(type: SystemLogType, message: String, time: Long = System.currentTimeMillis()): Unit =
    SystemLogService.log(type, message, time)

fun sysLogB(type: SystemLogType, message: String, time: Long = System.currentTimeMillis()): Unit =
    SystemLogService.logB(type, message, time)

suspend fun adminLog(
    type: AdminLogType,
    message: String,
    sessionId: Int,
    time: Long = System.currentTimeMillis()
): Unit =
    AdminLogService.log(type, message, sessionId, time)

fun adminLogB(type: AdminLogType, message: String, sessionId: Int, time: Long = System.currentTimeMillis()): Unit =
    AdminLogService.logB(type, message, sessionId, time)

suspend fun UserSession.log(type: AdminLogType, message: String, time: Long = System.currentTimeMillis()): Unit =
    AdminLogService.log(type, message, id, time)