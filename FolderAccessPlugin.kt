package com.auralis.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * FolderAccessPlugin
 *
 * Wraps Android's Storage Access Framework so the web layer can:
 *   1. pickFolder()  -> user picks a folder once, we keep permission forever
 *   2. listFiles(uri) -> re-list that folder's audio/video files any time,
 *                        including on a fresh app launch (no re-picking).
 *
 * This is the piece that makes Auralis remember a folder like a real app,
 * instead of asking the user to pick files every session.
 */
@CapacitorPlugin(name = "FolderAccess")
class FolderAccessPlugin : Plugin() {

    private var pendingCall: PluginCall? = null

    @PluginMethod
    fun pickFolder(call: PluginCall) {
        pendingCall = call

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION or
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        )

        startActivityForResult(call, intent, "folderPickResult")
    }

    @com.getcapacitor.annotation.ActivityCallback
    private fun folderPickResult(call: PluginCall?, result: androidx.activity.result.ActivityResult) {
        if (call == null) return

        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) {
            call.reject("No folder selected")
            return
        }

        val treeUri: Uri = result.data!!.data!!

        // This is the key line: without it, permission disappears the
        // moment the app process is killed, and you'd be back to picking
        // a folder every launch.
        context.contentResolver.takePersistableUriPermission(
            treeUri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION
        )

        val ret = JSObject()
        ret.put("uri", treeUri.toString())
        call.resolve(ret)
    }

    @PluginMethod
    fun listFiles(call: PluginCall) {
        val uriString = call.getString("uri")
        if (uriString == null) {
            call.reject("Missing uri")
            return
        }

        val treeUri = Uri.parse(uriString)
        val dir = DocumentFile.fromTreeUri(context, treeUri)

        if (dir == null || !dir.isDirectory) {
            call.reject("Could not open folder")
            return
        }

        val mediaExtensions = listOf(
            "mp3", "wav", "m4a", "ogg", "flac", "aac",
            "mp4", "mov", "webm", "mkv", "avi"
        )

        val filesArray = JSArray()

        // Top-level only for now; recurse into dir.listFiles() if you want
        // subfolders included later.
        for (file in dir.listFiles()) {
            if (!file.isFile) continue

            val name = file.name ?: continue
            val ext = name.substringAfterLast('.', "").lowercase()

            if (ext !in mediaExtensions) continue

            val entry = JSObject()
            entry.put("name", name)
            entry.put("uri", file.uri.toString())
            entry.put("mimeType", file.type ?: "")
            entry.put("size", file.length())
            filesArray.put(entry)
        }

        val ret = JSObject()
        ret.put("files", filesArray)
        call.resolve(ret)
    }
}
