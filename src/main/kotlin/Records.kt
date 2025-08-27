package com.batr

import com.batr.auth.getSession
import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.log.AdminLogType
import com.batr.log.log
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.encodedPath
import io.ktor.http.path
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.response.respondFile
import io.ktor.server.response.respondRedirect
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.util.url
import java.io.File
import kotlin.properties.Delegates

object Records {
    private var recordsFolder: File by Delegates.notNull()

    fun load(app: Application) {
        recordsFolder = File(app.environment.config.property("records.path").getString())
        recordsFolder.mkdirs()
    }

    fun getRecordsList(): List<String> = recordsFolder.list().filter { it.contains(".") }

    fun getRecord(filename: String): File? {
        if (filename.contains("..") || filename.contains(File.separator)) return null
        val file = recordsFolder.resolve(filename)
        if (!file.exists() || !file.isFile) return null
        return file
    }

    fun configureRouting(app: Application) {
        app.routing {
            authenticate("session-auth") {
                setPermissions(UserPermissions(records = true)) {
                    route("/api/records") {
                        get {
                            val filename = call.queryParameters["filename"]
                            if (filename == null) {
                                call.respond(getRecordsList())
                                return@get
                            }

                            val raw = call.request.queryParameters["raw"]?.toBoolean() == true
                            val download = call.request.queryParameters["download"]?.toBoolean() == true

                            if (raw && download) {
                                call.respond(HttpStatusCode.BadRequest, "Choose either raw or download, not both")
                                return@get
                            }

                            val session = call.getSession() ?: return@get
                            val file = getRecord(filename)
                            if (file == null) {
                                call.respond(HttpStatusCode.BadRequest, "file not found")
                                return@get
                            }

                            if (!raw && !download) {
                                val redirect = call.url {
                                    path("/records/player.html")
                                    parameters.append("filename", filename)
                                }
                                call.respondRedirect(redirect)
                                return@get
                            }

                            if (download) {
                                session.log(AdminLogType.RECORD_DOWNLOAD, "Download $filename")
                                call.response.headers.append(
                                    HttpHeaders.ContentDisposition,
                                    ContentDisposition.Attachment
                                        .withParameter(ContentDisposition.Parameters.FileName, file.name)
                                        .toString()
                                )
                                call.respondFile(file)
                                return@get
                            }

                            call.respondFile(file)
                        }
                    }
                }
            }
        }
    }

}