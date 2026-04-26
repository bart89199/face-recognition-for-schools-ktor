package com.batr

import com.batr.auth.configureAuth
import com.batr.database.Database.configureDatabase
import com.batr.log.AdminLogService
import com.batr.log.SystemLogService
import com.batr.log.SystemLogType
import com.batr.log.loadLogConst
import com.batr.pythonConnection.PythonConnection
import com.batr.settings.SystemSettingsService
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.forwardedheaders.ForwardedHeaders
import io.ktor.server.plugins.forwardedheaders.XForwardedHeaders
import io.ktor.server.plugins.hsts.HSTS
import java.io.File

const val HOME_PATH = "/"
const val LOGIN_PATH = "/login"
fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

val applicationHttpClient = HttpClient(CIO) {
    install(io.ktor.client.plugins.contentnegotiation.ContentNegotiation) {
        json()
    }
}

fun Application.module() {
    try {
        if (environment.config.property("is-using-reversed-proxy").getString().toBoolean()) {
            install(ForwardedHeaders)
            install(XForwardedHeaders)
        }
        install(HSTS) {
            maxAgeInSeconds = 31536000 // 1 год
            includeSubDomains = true
        }
        try {
            SystemSettingsService.load(this)
        } catch (e: Throwable) {
            e.printStackTrace()
        }
        configureDatabase()
        monitor.subscribe(ApplicationStarted) {
            SystemLogService.logB(SystemLogType.SYSTEM_START, "System started")
        }

        monitor.subscribe(ApplicationStopped) {
            SystemLogService.logB(SystemLogType.SYSTEM_STOP, "System stoped")
            try {
                SystemSettingsService.save()
            } catch (e: Throwable) {
                e.printStackTrace()
            }
        }

//        install(CORS) {
//            allowMethod(HttpMethod.Options)
//            allowMethod(HttpMethod.Get)
//            allowMethod(HttpMethod.Put)
//            allowMethod(HttpMethod.Post)
//            allowMethod(HttpMethod.Delete)
//            allowMethod(HttpMethod.Patch)
//            allowHeader(HttpHeaders.Authorization)
//            anyHost()
//        }



        loadLogConst()


        configureAuth()
        SystemLogService.load()
        AdminLogService.load()

        configureSerialization()

        SystemSettingsService.configureRouting(this)
        configureSockets()
        configureRouting()
        configureAccess()

        SystemLogService.configureRouting(this)
        AdminLogService.configureRouting(this)
        Records.configureRouting(this)
        Records.load()

        configureStreaming()
        configureInfo()
        configureTest()

        PythonConnection.configureRouting(this)

    } catch (e: Throwable) {
        e.printStackTrace()
    }

}

fun getEnv(name: String) = System.getenv(name)

fun getEnvOrNull(name: String) = System.getenv()[name]

fun getEnvOrEnvFile(name: String, fileEnvName: String = name + "_FILE"): String {
    getEnvOrNull(name)?.let { return it }
    val path = getEnvOrNull(fileEnvName) ?: throw RuntimeException("$name in env not found")
    val file = File(path)
    return file.readText().trimIndent().replace("\n", "")
}

fun getEnvOrEnvFileOrNull(name: String, fileEnvName: String = name + "_FILE"): String? =
    runCatching { getEnvOrEnvFile(name, fileEnvName) }.getOrNull()
fun getEnvOrEnvFileOrDef(name: String, def: String, fileEnvName: String = name + "_FILE"): String =
    getEnvOrEnvFileOrNull(name, fileEnvName) ?: def