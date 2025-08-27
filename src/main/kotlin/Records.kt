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
import io.ktor.server.application.ApplicationCall
import io.ktor.server.auth.authenticate
import io.ktor.server.http.content.file
import io.ktor.server.response.respond
import io.ktor.server.response.respondFile
import io.ktor.server.response.respondOutputStream
import io.ktor.server.response.respondRedirect
import io.ktor.server.response.respondText
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.head
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.util.url
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import kotlin.math.min
import kotlin.properties.Delegates

object Records {
    private var recordsFolder: File by Delegates.notNull()

    fun load(app: Application) {
        recordsFolder = File(app.environment.config.property("records.path").getString())
        recordsFolder.mkdirs()
    }


    private fun safeFilename(name: String?): Boolean =
        name != null &&
                name.isNotBlank() &&
                !name.contains("..") &&
                !name.contains('/') &&
                !name.contains('\\')

    private fun resolveRecord(filename: String?): File? {
        if (!safeFilename(filename)) return null
        val f = recordsFolder.resolve(filename!!)
        if (!f.exists() || !f.isFile) return null
        return f
    }

    fun getRecordsList(): List<String> =
        recordsFolder.list()?.filter { it.contains('.') }?.sorted() ?: emptyList()


    fun configureRouting(app: Application) {
        app.routing {
            authenticate("session-auth") {
                setPermissions(UserPermissions(records = true)) {
                    route("/api/records") {

                        // Список файлов
                        get {
                            val filename = call.request.queryParameters["filename"]
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

                            val file = resolveRecord(filename)
                            if (file == null) {
                                call.respond(HttpStatusCode.BadRequest, "file not found")
                                return@get
                            }

                            // Отдать страницу с JS‑плеером
                            if (!raw && !download) {
                                val redirectUrl = call.url {
                                    encodedPath = "/records/player.html"
                                    parameters.append("filename", filename)
                                }
                                call.respondRedirect(redirectUrl)
                                return@get
                            }

                            val contentType = file.detectContentType()

                            if (download) {
                                session.log(AdminLogType.RECORD_DOWNLOAD, "Download $filename")
                                call.streamFileWithRange(
                                    file = file,
                                    contentType = contentType,
                                    asAttachment = true,
                                    downloadName = file.name
                                )
                                return@get
                            }

                            // raw=true -> inline воспроизведение
                            call.streamFileWithRange(
                                file = file,
                                contentType = contentType,
                                asAttachment = false
                            )
                        }

                        // HEAD можно дергать как /api/records?filename=...&raw=true
                        head {
                            val filename = call.request.queryParameters["filename"]
                            if (filename == null) {
                                call.respond(HttpStatusCode.BadRequest, "filename required")
                                return@head
                            }
                            val file = resolveRecord(filename)
                            if (file == null) {
                                call.respond(HttpStatusCode.BadRequest, "file not found")
                                return@head
                            }
                            val download = call.request.queryParameters["download"]?.toBoolean() == true
                            val contentType = file.detectContentType()
                            call.respondHeadOnly(
                                file = file,
                                contentType = contentType,
                                asAttachment = download,
                                downloadName = file.name
                            )
                        }
                    }
                }
            }
        }
    }


    /* ===================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================== */

    private fun File.detectContentType(): ContentType =
        when (extension.lowercase()) {
            "mp4" -> ContentType.Video.MP4
            "webm" -> ContentType("video", "webm")
            "mkv" -> ContentType("video", "x-matroska")
            "mov" -> ContentType("video", "quicktime")
            "avi" -> ContentType("video", "x-msvideo")
            "m4v" -> ContentType("video", "x-m4v")
            else -> ContentType.Application.OctetStream
        }

    private fun File.etag(): String {
        val md = MessageDigest.getInstance("MD5")
        val bytes = (absolutePath + lastModified() + length()).toByteArray()
        val h = md.digest(bytes)
        return buildString(h.size * 2) {
            h.forEach { b ->
                append(((b.toInt() ushr 4) and 0xF).toString(16))
                append((b.toInt() and 0xF).toString(16))
            }
        }
    }

    /**
     * HEAD без тела
     */
    private suspend fun ApplicationCall.respondHeadOnly(
        file: File,
        contentType: ContentType,
        asAttachment: Boolean,
        downloadName: String?,
    ) {
        val total = file.length()
        response.headers.append(HttpHeaders.AcceptRanges, "bytes")
        response.headers.append(HttpHeaders.LastModified, file.lastModified().toString())
        response.headers.append(HttpHeaders.ETag, file.etag())
        response.headers.append(HttpHeaders.ContentType, contentType.toString())
        response.headers.append(HttpHeaders.ContentLength, total.toString())
        if (asAttachment) {
            val cd = ContentDisposition.Attachment
                .withParameter(ContentDisposition.Parameters.FileName, downloadName ?: file.name)
            response.headers.append(HttpHeaders.ContentDisposition, cd.toString())
        }
        respond(HttpStatusCode.OK)
    }

    /**
     * Отдача файла с поддержкой одиночного Range.
     */
    private suspend fun ApplicationCall.streamFileWithRange(
        file: File,
        contentType: ContentType,
        asAttachment: Boolean,
        downloadName: String? = null,
        bufferSize: Int = 64 * 1024
    ) {
        val total = file.length()
        val etag = file.etag()
        response.headers.append(HttpHeaders.AcceptRanges, "bytes")
        response.headers.append(HttpHeaders.ETag, etag)
        response.headers.append(HttpHeaders.LastModified, file.lastModified().toString())

        if (asAttachment) {
            val cd = ContentDisposition.Attachment
                .withParameter(ContentDisposition.Parameters.FileName, downloadName ?: file.name)
            response.headers.append(HttpHeaders.ContentDisposition, cd.toString())
        }

        val rangeHeader = request.headers[HttpHeaders.Range]

        if (rangeHeader == null || !rangeHeader.startsWith("bytes=", ignoreCase = true)) {
            // Полный файл
            response.status(HttpStatusCode.OK)
            response.headers.append(HttpHeaders.ContentType, contentType.toString())
            response.headers.append(HttpHeaders.ContentLength, total.toString())
            respondOutputStream(contentType) {
                withContext(Dispatchers.IO) {
                    RandomAccessFile(file, "r").use { raf ->
                        val buf = ByteArray(bufferSize)
                        var remaining = total
                        while (remaining > 0) {
                            val read = raf.read(buf, 0, min(buf.size.toLong(), remaining).toInt())
                            if (read == -1) break
                            try {
                                write(buf, 0, read)
                            } catch (_: Throwable) {
                                // клиент закрыл соединение
                                break
                            }
                            remaining -= read
                        }
                        flush()
                    }
                }
            }
            return
        }

        val rangeValue = rangeHeader.removePrefix("bytes=").trim()
        if (rangeValue.contains(",")) {
            respond(HttpStatusCode.NotImplemented, "Multiple ranges not supported")
            return
        }

        val (start, endIncl) = try {
            parseRange(rangeValue, total)
        } catch (_: Exception) {
            respondRangeNotSatisfiable(total)
            return
        }

        if (start >= total) {
            respondRangeNotSatisfiable(total)
            return
        }

        val realEnd = min(endIncl, total - 1)
        val length = realEnd - start + 1
        val contentRange = "bytes $start-$realEnd/$total"

        response.status(HttpStatusCode.PartialContent)
        response.headers.append(HttpHeaders.ContentType, contentType.toString())
        response.headers.append(HttpHeaders.ContentRange, contentRange)
        response.headers.append(HttpHeaders.ContentLength, length.toString())

        respondOutputStream(contentType) {
            withContext(Dispatchers.IO) {
                RandomAccessFile(file, "r").use { raf ->
                    raf.seek(start)
                    val buf = ByteArray(bufferSize)
                    var remaining = length
                    while (remaining > 0) {
                        val read = raf.read(buf, 0, min(buf.size.toLong(), remaining).toInt())
                        if (read == -1) break
                        try {
                            write(buf, 0, read)
                        } catch (_: Throwable) {
                            break
                        }
                        remaining -= read
                    }
                    flush()
                }
            }
        }
    }

    private fun parseRange(raw: String, total: Long): Pair<Long, Long> {
        return when {
            raw.startsWith("-") -> {
                // последние N байт
                val suffix = raw.substring(1).toLong()
                if (suffix <= 0) throw IllegalArgumentException()
                val start = (total - suffix).coerceAtLeast(0)
                start to (total - 1)
            }

            raw.endsWith("-") -> {
                val start = raw.removeSuffix("-").toLong()
                if (start < 0) throw IllegalArgumentException()
                start to (total - 1)
            }

            else -> {
                val parts = raw.split("-")
                if (parts.size != 2) throw IllegalArgumentException()
                val start = parts[0].toLong()
                val end = parts[1].toLong()
                if (start < 0 || end < start) throw IllegalArgumentException()
                start to end
            }
        }
    }

    private suspend fun ApplicationCall.respondRangeNotSatisfiable(total: Long) {
        response.headers.append(HttpHeaders.ContentRange, "bytes */$total")
        respond(HttpStatusCode.RequestedRangeNotSatisfiable)
    }

}