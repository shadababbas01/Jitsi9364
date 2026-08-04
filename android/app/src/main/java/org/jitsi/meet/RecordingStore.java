package org.jitsi.meet;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;

/**
 * Persists recording links received from the Jitsi SDK so they can be shown on
 * a separate screen after the call ends.
 */
public final class RecordingStore {
    private static final String PREFS_NAME = "org.jitsi.meet.recordings";
    private static final String KEY_RECORDINGS = "recordings";
    private static final int MAX_RECORDINGS = 50;

    private static final SimpleDateFormat DISPLAY_DATE =
        new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US);

    private RecordingStore() {
    }

    public static void upsertRecording(Context context, HashMap<String, Object> data) {
        String url = asString(data.get("link"));
        if (url == null || url.isEmpty()) {
            return;
        }

        long now = System.currentTimeMillis();
        long ttlSeconds = asLong(data.get("ttl"));
        long expiresAt = ttlSeconds > 0 ? now + (ttlSeconds * 1000L) : 0L;

        RecordingEntry entry = new RecordingEntry(
            url,
            buildTitle(data, now),
            asString(data.get("mode")),
            asString(data.get("status")),
            asString(data.get("error")),
            now,
            expiresAt
        );

        List<RecordingEntry> recordings = getRecordings(context);
        List<RecordingEntry> filtered = new ArrayList<>();
        for (RecordingEntry existing : recordings) {
            if (!url.equals(existing.url)) {
                filtered.add(existing);
            }
        }

        filtered.add(entry);
        Collections.sort(filtered, Comparator.comparingLong((RecordingEntry value) -> value.receivedAt).reversed());

        if (filtered.size() > MAX_RECORDINGS) {
            filtered = new ArrayList<>(filtered.subList(0, MAX_RECORDINGS));
        }

        persist(context, filtered);
    }

    public static boolean hasRecordings(Context context) {
        return !getRecordings(context).isEmpty();
    }

    public static List<RecordingEntry> getRecordings(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String serialized = preferences.getString(KEY_RECORDINGS, "[]");

        List<RecordingEntry> recordings = new ArrayList<>();

        try {
            JSONArray array = new JSONArray(serialized);
            for (int i = 0; i < array.length(); i++) {
                JSONObject object = array.getJSONObject(i);
                recordings.add(RecordingEntry.fromJson(object));
            }
        } catch (JSONException e) {
            // If persistence is corrupted, start fresh on the next write.
            recordings.clear();
        }

        recordings.sort(Comparator.comparingLong((RecordingEntry value) -> value.receivedAt).reversed());
        return recordings;
    }

    public static void clear(Context context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_RECORDINGS)
            .apply();
    }

    private static void persist(Context context, List<RecordingEntry> recordings) {
        JSONArray array = new JSONArray();
        for (RecordingEntry entry : recordings) {
            array.put(entry.toJson());
        }

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_RECORDINGS, array.toString())
            .apply();
    }

    private static String buildTitle(HashMap<String, Object> data, long receivedAt) {
        String mode = asString(data.get("mode"));
        String status = asString(data.get("status"));
        StringBuilder builder = new StringBuilder("Jibri recording");

        if (mode != null && !mode.isEmpty()) {
            builder.append(" (").append(mode).append(")");
        }

        if (status != null && !status.isEmpty()) {
            builder.append(" ").append(status);
        }

        builder.append(" - ").append(DISPLAY_DATE.format(new Date(receivedAt)));
        return builder.toString();
    }

    private static @Nullable String asString(@Nullable Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static long asLong(@Nullable Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }

        if (value != null) {
            try {
                return Long.parseLong(String.valueOf(value));
            } catch (NumberFormatException ignored) {
                return 0L;
            }
        }

        return 0L;
    }

    public static final class RecordingEntry {
        public final String url;
        public final String title;
        public final String mode;
        public final String status;
        public final String error;
        public final long receivedAt;
        public final long expiresAt;

        RecordingEntry(String url, String title, String mode, String status, String error, long receivedAt, long expiresAt) {
            this.url = url;
            this.title = title;
            this.mode = mode;
            this.status = status;
            this.error = error;
            this.receivedAt = receivedAt;
            this.expiresAt = expiresAt;
        }

        static RecordingEntry fromJson(JSONObject object) throws JSONException {
            String url = object.optString("url", object.optString("link", ""));
            String title = object.optString("title", url);
            return new RecordingEntry(
                url,
                title,
                object.optString("mode", null),
                object.optString("status", null),
                object.optString("error", null),
                object.optLong("receivedAt", object.optLong("createdAt", System.currentTimeMillis())),
                object.optLong("expiresAt", 0L)
            );
        }

        JSONObject toJson() {
            JSONObject object = new JSONObject();
            try {
                object.put("url", url);
                object.put("title", title);
                object.put("mode", mode);
                object.put("status", status);
                object.put("error", error);
                object.put("receivedAt", receivedAt);
                object.put("expiresAt", expiresAt);
            } catch (JSONException ignored) {
                // JSONObject#put only throws for invalid NaN values here.
            }
            return object;
        }

        public String getSubtitle() {
            StringBuilder builder = new StringBuilder();

            if (receivedAt > 0) {
                builder.append(DISPLAY_DATE.format(new Date(receivedAt)));
            }

            if (expiresAt > 0) {
                if (builder.length() > 0) {
                    builder.append("  ");
                }
                builder.append("expires ").append(DISPLAY_DATE.format(new Date(expiresAt)));
            }

            if (error != null && !error.isEmpty()) {
                if (builder.length() > 0) {
                    builder.append("  ");
                }
                builder.append("error: ").append(error);
            }

            return builder.toString();
        }
    }
}
