package org.jitsi.meet;

import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import java.io.IOException;

public class RecordingPlayerActivity extends AppCompatActivity {
    private MediaPlayer mediaPlayer;
    private TextView statusView;
    private Button playPauseButton;
    private Button stopButton;
    private String recordingUrl;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recording_player);

        recordingUrl = getIntent().getStringExtra(RecordingsActivity.EXTRA_URL);
        String title = getIntent().getStringExtra(RecordingsActivity.EXTRA_TITLE);

        TextView titleView = findViewById(R.id.recordingTitle);
        TextView urlView = findViewById(R.id.recordingUrl);
        statusView = findViewById(R.id.recordingStatus);
        playPauseButton = findViewById(R.id.recordingPlayPauseButton);
        stopButton = findViewById(R.id.recordingStopButton);

        titleView.setText(title == null ? "Recording" : title);
        urlView.setText(recordingUrl == null ? "" : recordingUrl);

        playPauseButton.setOnClickListener(v -> togglePlayback());
        stopButton.setOnClickListener(v -> stopPlayback());

        if (recordingUrl == null || recordingUrl.isEmpty()) {
            statusView.setText("Missing recording URL.");
            playPauseButton.setEnabled(false);
            stopButton.setEnabled(false);
            return;
        }

        preparePlayer();
    }

    @Override
    protected void onStop() {
        super.onStop();
        stopPlayback();
    }

    @Override
    protected void onDestroy() {
        releasePlayer();
        super.onDestroy();
    }

    private void preparePlayer() {
        releasePlayer();

        mediaPlayer = new MediaPlayer();
        mediaPlayer.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        );
        mediaPlayer.setOnPreparedListener(player -> {
            statusView.setText("Ready to play.");
            playPauseButton.setText("Pause");
            player.start();
        });
        mediaPlayer.setOnCompletionListener(player -> {
            statusView.setText("Playback finished.");
            playPauseButton.setText("Play");
        });
        mediaPlayer.setOnErrorListener((player, what, extra) -> {
            statusView.setText("Playback failed: " + what + "/" + extra);
            playPauseButton.setText("Play");
            return true;
        });

        try {
            statusView.setText("Loading...");
            mediaPlayer.setDataSource(recordingUrl);
            mediaPlayer.prepareAsync();
        } catch (IOException e) {
            statusView.setText("Unable to load recording.");
            playPauseButton.setEnabled(false);
            stopButton.setEnabled(false);
            releasePlayer();
        }
    }

    private void togglePlayback() {
        if (mediaPlayer == null) {
            preparePlayer();
            return;
        }

        if (mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            playPauseButton.setText("Play");
            statusView.setText("Paused.");
        } else {
            mediaPlayer.start();
            playPauseButton.setText("Pause");
            statusView.setText("Playing.");
        }
    }

    private void stopPlayback() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
            } catch (IllegalStateException ignored) {
                // Player may already be stopped or released.
            }
            releasePlayer();
        }

        if (playPauseButton != null) {
            playPauseButton.setText("Play");
        }
        if (statusView != null) {
            statusView.setText("Stopped.");
        }
    }

    private void releasePlayer() {
        if (mediaPlayer != null) {
            mediaPlayer.reset();
            mediaPlayer.release();
            mediaPlayer = null;
        }
    }
}
