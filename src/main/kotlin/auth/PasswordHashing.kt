package com.batr.auth

import com.password4j.Hash
import com.password4j.Password


object PasswordHasher {
    fun hash(raw: String): Hash {
        return Password.hash(raw).addPepper().withArgon2()
    }

    fun verify(pass: String, hash: String): Boolean {
        return Password.check(pass, hash).addPepper().withArgon2()
    }

    fun verify(pass: String, hash: Hash): Boolean {
        return Password.check(pass, hash)
    }

}