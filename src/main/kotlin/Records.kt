package com.batr

import com.batr.auth.getSession
import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.log.AdminLogType
import com.batr.log.log
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
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

                            val session = call.getSession() ?: return@get
                            val file = getRecord(filename)
                            if (file == null) {
                                call.respond(HttpStatusCode.BadRequest, "file not found")
                                return@get
                            }

                            session.log(AdminLogType.RECORD_DOWNLOAD, "Download $filename")
                            call.response.headers.append(
                                HttpHeaders.ContentDisposition,
                                ContentDisposition.Attachment
                                    .withParameter(ContentDisposition.Parameters.FileName, file.name)
                                    .toString()
                            )
                            call.respondFile(file)

                        }
                    }
                }
            }
        }
    }

}