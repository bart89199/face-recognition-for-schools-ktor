package com.batr.log

import com.batr.auth.session.UserSession
import io.ktor.server.application.Application
import kotlin.properties.Delegates

var currentTimePeriodMs: Long by Delegates.notNull()
    private set

fun Application.loadLogConsts() {
    currentTimePeriodMs = environment.config.property("log.current-time-period-ms").getString().toLong()
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