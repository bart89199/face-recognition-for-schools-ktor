package com.batr.pythonConnection

import com.batr.log.SystemLogType
import com.batr.log.sysLog
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.imageio.ImageIO

object PythonConnection {
    var systemStatus: SystemStatus? = null
        private set

    private suspend fun updateStatus(newStatus: SystemStatus) {
        if (systemStatus?.door == false && newStatus.door) {
            sysLog(SystemLogType.DOOR, "Door opened")
        }
        if (systemStatus?.door == true && !newStatus.door) {
            sysLog(SystemLogType.DOOR, "Door closed")
        }

        for (name in newStatus.recognitions) {
            if (systemStatus?.recognitions?.contains(name) == false) {
                sysLog(SystemLogType.RECOGNIZE, "$name was recognized")
            }
        }

        systemStatus = newStatus

    }

    fun configureRouting(app: Application) {
        app.routing {
            authenticate("bearer-auth") {
                route("api/py") {
                    post("/status") {
                        val newStatus = call.receive<SystemStatus>()
                        updateStatus(newStatus)
                        call.respond(HttpStatusCode.OK)
                    }
                }
            }
        }
    }
}

@Serializable
data class SystemStatus(
    val door: Boolean,
    val recognitions: List<String>
)

//
//object PythonConnection {
//
//    var clientSocket: Socket? = null
//        private set
//    var serverSocket: ServerSocket? = null
//        private set
//    var inputStream: InputStream? = null
//        private set
//    var outputStream: OutputStream? = null
//        private set
//
//     fun connect() {
//        try {
//            serverSocket = ServerSocket(8082)
//            println("Waiting python...")
//            clientSocket = serverSocket!!.accept()
//            println("Python connected")
//            inputStream = clientSocket!!.getInputStream()
//            outputStream = clientSocket!!.getOutputStream()
//            sendString("work")
//        } catch (ex: IOException) {
//            println("Can't connect python: ${ex.message}")
//            return
//        }
//    }
//
//    fun closeConnection() {
//        inputStream?.close()
//        outputStream?.close()
//        clientSocket?.close()
//        serverSocket?.close()
//    }
//
//
//    fun receiveBytes(size: Int): ByteArray {
//        val buffer = ByteArray(size)
//        var bytesRead = 0
//        while (bytesRead < size) {
//            val result = inputStream?.read(buffer, bytesRead, size - bytesRead)
//                ?: throw kotlin.IllegalStateException("Python socket not connected")
//            if (result == -1) break
//            bytesRead += result
//        }
//        return buffer
//    }
//
//    fun receiveBytes() = receiveBytes(receiveInts(1)[0])
//
//    fun receiveInts(size: Int): IntArray {
//        val buffer = receiveBytes(size * 4)
//        val byteBuffer = ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN)
//        val intBuffer = byteBuffer.asIntBuffer()
//        val rem = intBuffer.remaining()
//        val data = IntArray(rem)
//        intBuffer.get(data)
//        return data
////    val buffer = receiveBytes(size * 4, input).map { it.toInt() }
////    val data = IntArray(size)
////    for (i in 0..<size) {
////        data[i] = buffer[i * 4] or (buffer[i * 4 + 1] shl 8) or (buffer[i * 4 + 2] shl 16) or (buffer[i * 4 + 3] shl 24)
////    }
////    return data
//    }
//
//    fun receiveInts() = receiveInts(receiveInts(1)[0] / 4)
//
//    fun receiveString(size: Int): String {
//        val buffer = receiveBytes(size)
//        return buffer.decodeToString()
//    }
//
//    fun receiveString() = receiveString(receiveInts(1)[0])
//
//    fun receiveImage(): BufferedImage {
//        val imageBytes = receiveBytes()
//        val img = ImageIO.read(ByteArrayInputStream(imageBytes))
//        return img
//    }
//
////    fun receiveImage(height: Int, width: Int): BufferedImage {
////        val buffer = receiveBytes(height * width * 3).map { it.toUByte().toInt() }
////        val bi = BufferedImage(width, height, BufferedImage.TYPE_INT_RGB)
////        for (i in 0..<height) for (j in 0..<width) bi.setRGB(
////            j,
////            i,
////            buffer[(i * width + j) * 3] or (buffer[(i * width + j) * 3 + 1] shl 8) or (buffer[(i * width + j) * 3 + 2] shl 16)
////        )
////        return bi
////    }
////
////    fun receiveImage(): BufferedImage {
////        val sizeData = receiveInts(2)
////        return receiveImage(sizeData[0], sizeData[1])
////    }
//
//    fun sendStaff(size: IntArray, sendSize: Boolean = true, message: String? = null) {
//        message?.let { sendString(message) }
//        if (sendSize) {
//            sendInts(size, false)
//        }
//    }
//
//    fun sendStaff(size: Int, sendSize: Boolean = true, message: String? = null) =
//        sendStaff(intArrayOf(size), sendSize, message)
//
//    fun sendBytes(byteArray: ByteArray, sendSize: Boolean = true, message: String? = null) {
//        sendStaff(byteArray.size, sendSize, message)
//
//        outputStream?.write(byteArray) ?: throw kotlin.IllegalStateException("Python socket not connected")
//    }
//
//    fun sendByte(byte: Byte, sendSize: Boolean = true, message: String? = null) = sendBytes(byteArrayOf(byte), sendSize, message)
//
//
//    fun sendInts(intArray: IntArray, sendSize: Boolean = true, message: String? = null) {
//        sendStaff(intArray.size, sendSize, message)
//
//        val reply: ByteBuffer = ByteBuffer.allocate(intArray.size * 4).order(ByteOrder.LITTLE_ENDIAN)
//        for (i in 0..<intArray.size) {
//            reply.putInt(intArray[i])
//        }
//        sendBytes(reply.array(), false)
//    }
//
//    fun sendInt(int: Int, sendSize: Boolean = true, message: String? = null) = sendInts(intArrayOf(int), sendSize, message)
//
//    fun sendImage(image: BufferedImage, message: String? = null) {
//        sendStaff(intArrayOf(), false, message)
//        val out = ByteArrayOutputStream()
//        ImageIO.write(image, "jpg", out)
//        val bytes = out.toByteArray()
//        sendBytes(bytes)
//    }
//
////    fun sendImage(image: BufferedImage, sendSize: Boolean = true, message: String? = null) {
////        sendStaff(intArrayOf(image.height, image.width), sendSize, message)
////
////        val pixels = ByteArray(image.height * image.width * 3)
////        for (i in 0..<image.height) for (j in 0..<image.width) {
////            pixels[(i * image.width + j) * 3] = (image.getRGB(j, i) shr 16).toByte()
////            pixels[(i * image.width + j) * 3 + 1] = ((image.getRGB(j, i) shr 8) and 0xFF).toByte()
////            pixels[(i * image.width + j) * 3 + 2] = (image.getRGB(j, i) and 0xFF).toByte()
////        }
////        sendBytes(pixels, false)
////    }
//
//    fun sendString(string: String, sendSize: Boolean = true, message: String? = null) {
//        sendStaff(string.length, sendSize, message)
//
//        sendBytes(string.toByteArray(), false)
//    }
//
//
//}