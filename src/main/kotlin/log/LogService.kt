package com.batr.log

import com.batr.log.admin.AdminLogService
import com.batr.log.system.SystemLogService
import com.batr.log.system.configureSystemLogManager
import io.ktor.server.application.Application

object LogService {
    fun load() {
        SystemLogService.load()
        AdminLogService.load()
    }
    fun Application.configureLogManagers() {
        configureSystemLogManager()
    }

}