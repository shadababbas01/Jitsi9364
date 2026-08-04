package org.jitsi.meet;

import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class RecordingsActivity extends AppCompatActivity {
    public static final String EXTRA_URL = "org.jitsi.meet.extra.URL";
    public static final String EXTRA_TITLE = "org.jitsi.meet.extra.TITLE";
    public static final String EXTRA_SERVER_BASE_URL = "org.jitsi.meet.extra.SERVER_BASE_URL";
    private static final String RECORDINGS_INDEX_PATH = "recordings/index.json";
    private static final String TAG = RecordingsActivity.class.getSimpleName();

    private final List<RecordingStore.RecordingEntry> recordings = new ArrayList<>();
    private RecordingAdapter adapter;
    private TextView emptyState;
    private TextView subtitle;
    private String serverBaseUrl;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void open(Context context) {
        context.startActivity(new Intent(context, RecordingsActivity.class));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recordings);

        subtitle = findViewById(R.id.recordingsSubtitle);
        emptyState = findViewById(R.id.recordingsEmptyState);
        ListView listView = findViewById(R.id.recordingsList);
        Button clearButton = findViewById(R.id.recordingsClearButton);
        Button refreshButton = findViewById(R.id.recordingsRefreshButton);

        serverBaseUrl = getIntent().getStringExtra(EXTRA_SERVER_BASE_URL);
        subtitle.setText(serverBaseUrl == null || serverBaseUrl.isEmpty()
            ? "Showing locally cached recording links."
            : "Server index: " + getRecordingsIndexUrl());

        adapter = new RecordingAdapter();
        listView.setAdapter(adapter);
        listView.setOnItemClickListener(this::openRecording);

        clearButton.setOnClickListener(v -> {
            RecordingStore.clear(this);
            reload();
        });

        refreshButton.setOnClickListener(v -> reload());
    }

    @Override
    protected void onResume() {
        super.onResume();
        reload();
    }

    private void reload() {
        recordings.clear();
        recordings.addAll(RecordingStore.getRecordings(this));
        fetchRemoteRecordings();
        adapter.notifyDataSetChanged();

        boolean hasRecordings = !recordings.isEmpty();
        emptyState.setVisibility(hasRecordings ? View.GONE : View.VISIBLE);
    }

    private void fetchRemoteRecordings() {
        if (serverBaseUrl == null || serverBaseUrl.isEmpty()) {
            return;
        }

        final String endpointUrl = getRecordingsIndexUrl();

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(endpointUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setRequestMethod("GET");

                int status = connection.getResponseCode();
                InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();

                if (stream == null) {
                    return;
                }

                String body = readAll(stream);
                if (body.isEmpty()) {
                    return;
                }

                JSONArray array = new JSONArray(body);
                List<RecordingStore.RecordingEntry> remoteRecordings = new ArrayList<>();
                for (int i = 0; i < array.length(); i++) {
                    JSONObject object = array.getJSONObject(i);
                    remoteRecordings.add(parseRemoteRecording(object));
                }

                mergeRecordings(remoteRecordings);
            } catch (Exception e) {
                Log.w(TAG, "Failed to load remote recordings from " + endpointUrl, e);
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    private void mergeRecordings(List<RecordingStore.RecordingEntry> remoteRecordings) {
        if (remoteRecordings.isEmpty()) {
            return;
        }

        mainHandler.post(() -> {
            Map<String, RecordingStore.RecordingEntry> byUrl = new HashMap<>();
            for (RecordingStore.RecordingEntry entry : recordings) {
                byUrl.put(entry.url, entry);
            }

            for (RecordingStore.RecordingEntry entry : remoteRecordings) {
                byUrl.put(entry.url, entry);
            }

            recordings.clear();
            recordings.addAll(byUrl.values());
            Collections.sort(recordings, Comparator.comparingLong((RecordingStore.RecordingEntry value) -> value.receivedAt).reversed());
            adapter.notifyDataSetChanged();
            emptyState.setVisibility(recordings.isEmpty() ? View.VISIBLE : View.GONE);
        });
    }

    private RecordingStore.RecordingEntry parseRemoteRecording(JSONObject object) {
        String url = object.optString("url", object.optString("link", ""));
        String title = object.optString("title", url);
        String mode = object.optString("mode", null);
        String status = object.optString("status", null);
        String error = object.optString("error", null);
        long receivedAt = object.optLong("receivedAt", object.optLong("createdAt", System.currentTimeMillis()));
        long expiresAt = object.optLong("expiresAt", 0L);
        return new RecordingStore.RecordingEntry(url, title, mode, status, error, receivedAt, expiresAt);
    }

    private String getRecordingsIndexUrl() {
        String base = serverBaseUrl.endsWith("/") ? serverBaseUrl : serverBaseUrl + "/";
        return base + RECORDINGS_INDEX_PATH;
    }

    private static String readAll(InputStream stream) throws Exception {
        try (BufferedInputStream bufferedInputStream = new BufferedInputStream(stream);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = bufferedInputStream.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void openRecording(AdapterView<?> parent, View view, int position, long id) {
        RecordingStore.RecordingEntry recording = recordings.get(position);
        Intent intent = new Intent(this, RecordingPlayerActivity.class);
        intent.putExtra(EXTRA_URL, recording.url);
        intent.putExtra(EXTRA_TITLE, recording.title);
        startActivity(intent);
    }

    private final class RecordingAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return recordings.size();
        }

        @Override
        public Object getItem(int position) {
            return recordings.get(position);
        }

        @Override
        public long getItemId(int position) {
            return recordings.get(position).receivedAt;
        }

        @Override
        public View getView(int position, View convertView, @NonNull android.view.ViewGroup parent) {
            View view = convertView;
            if (view == null) {
                view = getLayoutInflater().inflate(android.R.layout.simple_list_item_2, parent, false);
            }

            TextView title = view.findViewById(android.R.id.text1);
            TextView subtitle = view.findViewById(android.R.id.text2);

            RecordingStore.RecordingEntry recording = recordings.get(position);
            title.setText(recording.title);
            subtitle.setText(recording.getSubtitle().isEmpty() ? recording.url : recording.getSubtitle());

            return view;
        }
    }
}
