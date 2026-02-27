package org.jitsi.meet;

import android.app.PictureInPictureParams;
import android.content.Intent;
import android.os.Bundle;
import android.util.Rational;
import android.view.View;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
public class DemoClass extends AppCompatActivity {



    TextView first, second,call;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.demo_class);
         first = findViewById(R.id.firstTxt);
         second = findViewById(R.id.secondTxt);
         call = findViewById(R.id.callTxt);


         first.setOnClickListener(new View.OnClickListener() {
             @Override
             public void onClick(View view) {
                // second.setText("CHanged---"+System.currentTimeMillis());
                 PictureInPictureParams.Builder builder = null;
                 if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                     builder = new PictureInPictureParams.Builder()
                             .setAspectRatio(new Rational(1, 1));
                     enterPictureInPictureMode(builder.build());

                 }

                 // Enter Picture-in-Picture mode
             }
         });
         call.setOnClickListener(new View.OnClickListener() {
             @Override
             public void onClick(View view) {
                 startActivity(new Intent(DemoClass.this, MainActivity.class));
             }
         });
    }
}
