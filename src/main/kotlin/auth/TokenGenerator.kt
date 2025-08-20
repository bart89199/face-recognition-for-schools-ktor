package com.batr.auth

import java.security.SecureRandom
import java.util.Base64

object TokenGenerator {
    const val SESSION_TOKEN_LEN: Int = 128

    fun generateSessionToken(): String {
        val bytes = ByteArray(SESSION_TOKEN_LEN)
        SecureRandom().nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }
}