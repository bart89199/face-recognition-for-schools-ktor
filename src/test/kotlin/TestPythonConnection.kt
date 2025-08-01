package com.batr

import com.batr.pythonConnection.PythonConnection
import java.awt.image.BufferedImage
import javax.imageio.ImageIO
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

val testBytes = byteArrayOf(1, 10, 100, 254.toByte(), 255.toByte())
val testInts = intArrayOf(1, 10, 100, 12345678, 123456789)
var classloader = Thread.currentThread().getContextClassLoader()
val testImage: BufferedImage = ImageIO.read(classloader.getResourceAsStream("test-img.png"))


class TestPythonConnection {

    //    @file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")
    @Test
    fun sendAndReceiveData() {
        PythonConnection.connect()

        PythonConnection.sendString("Start Test")
        var status = PythonConnection.receiveString()
        assertEquals(status, "ok")
        println("Test started")

        PythonConnection.sendBytes(testBytes)
        status = PythonConnection.receiveString()
        assertEquals(status, "ok")
        println("Bytes tested")

        PythonConnection.sendInts(testInts)
        status = PythonConnection.receiveString()
        assertEquals(status, "ok")
        println("Ints tested")

        PythonConnection.sendImage(testImage)
        status = PythonConnection.receiveString()
        assertEquals(status, "ok")
        println("Image send tested")

        val img = PythonConnection.receiveImage()

        assertEquals(checkDist(img, testImage, 10, 0.1), true)

        println("Image receive tested")

        val bytes = PythonConnection.receiveBytes()
        assertContentEquals(bytes, testBytes)
        println("Bytes receive tested")

        val ints = PythonConnection.receiveInts()
        assertContentEquals(ints, testInts)
        println("Ints receive tested")

        val spentTime = PythonConnection.receiveInts()[0].toDouble() / 1000

        println("Spent time: $spentTime s.")

        PythonConnection.closeConnection()
    }

    fun checkDist(img1: BufferedImage, img2: BufferedImage, maxDist: Int, maxBad: Double): Boolean {
        var bad = 0
        if (img1.height != img2.height || img1.width != img2.width) return false
        for (i in 0..<img1.height) for (j in 0..<img1.width) {
            if (abs(getRed(img1.getRGB(j, i)) - getRed(img2.getRGB(j, i))) > maxDist) bad++
            if (abs(getGreen(img1.getRGB(j, i)) - getGreen(img2.getRGB(j, i))) > maxDist) bad++
            if (abs(getBlue(img1.getRGB(j, i)) - getBlue(img2.getRGB(j, i))) > maxDist) bad++
        }
        return bad.toDouble() / (img1.height * img1.width * 3) <= maxBad
    }

    fun getRed(color: Int): Int {
        return color shr 16
    }

    fun getGreen(color: Int): Int {
        return (color shr 8) and 0xFF
    }

    fun getBlue(color: Int): Int {
        return color and 0xFF
    }


}