/**
 * Calendar Service - Create calendar events with meeting links
 * Supports: Google Calendar + Meet, Microsoft Teams, Zoom
 */

import axios from 'axios';
import crypto from 'crypto';

export const calendarService = {
  /**
   * Create Google Calendar event with Google Meet link
   */
  async createGoogleMeetEvent({
    accessToken,
    title,
    description,
    startTime,
    endTime,
    attendees,
    timezone = 'UTC',
  }) {
    try {
      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
        {
          summary: title,
          description: description || '',
          start: {
            dateTime: startTime, // ISO 8601 format: 2026-02-15T10:00:00
            timeZone: timezone,
          },
          end: {
            dateTime: endTime,
            timeZone: timezone,
          },
          attendees: attendees?.map((email) => ({ email })) || [],
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        eventId: response.data.id,
        meetingLink: response.data.hangoutLink,
        htmlLink: response.data.htmlLink,
        platform: 'google_meet',
      };
    } catch (error) {
      console.error('Google Calendar API error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error?.message || 'Failed to create Google Calendar event'
      );
    }
  },

  /**
   * Create Microsoft Teams meeting
   */
  async createTeamsMeeting({
    accessToken,
    title,
    description,
    startTime,
    endTime,
    attendees,
    timezone = 'UTC',
  }) {
    try {
      // Create online meeting
      const meetingResponse = await axios.post(
        'https://graph.microsoft.com/v1.0/me/onlineMeetings',
        {
          subject: title,
          startDateTime: startTime,
          endDateTime: endTime,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Create calendar event linked to online meeting
      const eventResponse = await axios.post(
        'https://graph.microsoft.com/v1.0/me/events',
        {
          subject: title,
          body: {
            contentType: 'HTML',
            content: description || '',
          },
          start: {
            dateTime: startTime,
            timeZone: timezone,
          },
          end: {
            dateTime: endTime,
            timeZone: timezone,
          },
          attendees:
            attendees?.map((email) => ({
              emailAddress: { address: email },
              type: 'required',
            })) || [],
          isOnlineMeeting: true,
          onlineMeetingUrl: meetingResponse.data.joinUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        eventId: eventResponse.data.id,
        meetingLink: meetingResponse.data.joinUrl,
        htmlLink: eventResponse.data.webLink,
        platform: 'teams',
      };
    } catch (error) {
      console.error('Microsoft Teams API error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to create Teams meeting');
    }
  },

  /**
   * Create Zoom meeting
   */
  async createZoomMeeting({
    accessToken,
    title,
    description,
    startTime,
    endTime,
    attendees,
    timezone = 'UTC',
  }) {
    try {
      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          topic: title,
          type: 2, // Scheduled meeting
          start_time: startTime,
          duration: Math.ceil((new Date(endTime) - new Date(startTime)) / 60000), // Duration in minutes
          timezone: timezone,
          agenda: description || '',
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            mute_upon_entry: false,
            approval_type: 0, // Automatically approve
            auto_recording: 'none',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        eventId: response.data.id.toString(),
        meetingLink: response.data.join_url,
        htmlLink: response.data.join_url,
        platform: 'zoom',
        meetingId: response.data.id,
        password: response.data.password,
      };
    } catch (error) {
      console.error('Zoom API error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create Zoom meeting');
    }
  },
};
