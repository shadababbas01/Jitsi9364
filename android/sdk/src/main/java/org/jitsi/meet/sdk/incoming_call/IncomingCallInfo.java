/*
 * Copyright @ 2018-present Atlassian Pty Ltd
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.jitsi.meet.sdk.incoming_call;

import androidx.annotation.NonNull;
import android.os.Bundle;


public class IncomingCallInfo {
    /**
     * URL for the caller avatar.
     */
    private String callerAvatarURL;

    /**
     * Caller's name.
     */
    private String callerName;
    /**
     * Caller's Detail
     */
    private String callerDetail;
    /**
     * Whether this is a regular call or a video call.
     */
    private boolean hasVideo;

    public IncomingCallInfo(
            @NonNull String callerName,
            @NonNull String callerAvatarURL,
            @NonNull String callerDetail,
            boolean hasVideo) {
        this.callerName = callerName;
        this.callerAvatarURL = callerAvatarURL;
        this.callerDetail = callerDetail;
        this.hasVideo = hasVideo;
    }

    public IncomingCallInfo(Bundle b) {
        super();

        if (b.containsKey("callerAvatarURL")) {
            callerAvatarURL = b.getString("callerAvatarURL");
        }

        if (b.containsKey("callerName")) {
            callerName = b.getString("callerName");
        }

        if (b.containsKey("callerDetail")) {
            callerDetail = b.getString("callerDetail");
        }

        if (b.containsKey("hasVideo")) {
            hasVideo = b.getBoolean("hasVideo");
        }
    }
    /**
     * Gets the caller's details.
     *
     * @return - The caller's details.
     */

    public String getCallerDetail() {
        return callerDetail;
    }

    public Bundle asBundle() {
        Bundle b = new Bundle();

        if (callerAvatarURL != null) {
            b.putString("callerAvatarURL", callerAvatarURL);
        }

        if (callerName != null) {
            b.putString("callerName", callerName);
        }

        if (callerDetail != null) {
            b.putString("callerDetail", callerDetail);
        }

        b.putBoolean("hasVideo", hasVideo);

        return b;
    }
    /**
     * Gets the caller's avatar URL.
     *
     * @return - The URL as a string.
     */
    public String getCallerAvatarURL() {
        return callerAvatarURL;
    }

    /**
     * Gets the caller's name.
     *
     * @return - The caller's name.
     */
    public String getCallerName() {
        return callerName;
    }

    /**
     * Gets whether the call is a video call or not.
     *
     * @return - {@code true} if this call has video; {@code false}, otherwise.
     */
    public boolean hasVideo() {
        return hasVideo;
    }
}
