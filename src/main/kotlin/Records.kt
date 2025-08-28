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
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.attribute.BasicFileAttributes
import kotlin.io.path.Path
import kotlin.properties.Delegates

object Records {
    private var recordsFolder: File by Delegates.notNull()

    fun load(app: Application) {
        recordsFolder = File(app.environment.config.property("records.path").getString())
        recordsFolder.mkdirs()
    }

    fun getRecordsList(): List<RecordModel> = recordsFolder.list().filter { it.contains(".") }.mapNotNull {
        try {
            val attributes = Files.readAttributes(Path(recordsFolder.path, it), BasicFileAttributes::class.java)
            RecordModel(it, attributes.creationTime().toMillis(), attributes.lastModifiedTime().toMillis())
        } catch (_: UnsupportedOperationException) {
            null
        } catch (_: IOException) {
            null
        }
    }

    fun getRecord(filename: String): File? {
        if (filename.contains("..") || filename.contains(File.separator)) return null
        val file = recordsFolder.resolve(filename)
        if (!file.exists() || !file.isFile) return null
        return file
    }

    fun getRecordsListFiltered(start: Long?, end: Long?): List<RecordModel> {
        val all = getRecordsList()
        if (start == null && end == null) return all
        return all.filter {
            val c = it.created
            (start == null || c >= start) && (end == null || c <= end)
        }
    }

    fun configureRouting(app: Application) {
        app.routing {
            authenticate("session-auth") {
                setPermissions(UserPermissions(records = true)) {
                    route("/api/records") {
                        get {
                            val filename = call.queryParameters["filename"]
                            if (filename == null) {
                                val start = call.request.queryParameters["start"]?.toLongOrNull()
                                val end = call.request.queryParameters["end"]?.toLongOrNull()
                                if (start != null && end != null && start > end) {
                                    call.respond(HttpStatusCode.BadRequest, "start must be <= end")
                                    return@get
                                }

                                val list = getRecordsListFiltered(start, end).sortedBy { it.created }
                                call.respond(list)
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

@Serializable
data class RecordModel(
    val filename: String,
    val created: Long,
    @SerialName("last_modified") val lastModified: Long,
)