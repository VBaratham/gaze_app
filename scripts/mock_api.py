#!/usr/bin/env python3
"""
Mock API Server for Gaze Tracking Experiment
Simulates AWS Lambda + API Gateway locally for development
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
import json
from datetime import datetime
from collections import defaultdict

app = Flask(__name__)
CORS(app)  # Enable CORS for local development

# In-memory storage (resets when server restarts)
sessions = {}
trials = []

@app.route('/sessions', methods=['POST', 'OPTIONS'])
def create_session():
    """Create a new experiment session"""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.json
        session_id = str(uuid.uuid4())

        session = {
            'sessionId': session_id,
            'participantId': data.get('participantId', f'P-{int(datetime.now().timestamp())}'),
            'calibrationAccuracy': data.get('calibrationAccuracy', 0),
            'browserInfo': data.get('browserInfo', {}),
            'startTime': int(datetime.now().timestamp() * 1000),
            'status': 'in_progress',
            'totalTrials': 0,
            'completedTrials': 0
        }

        sessions[session_id] = session

        print(f"[{datetime.now().isoformat()}] Created session: {session_id}")

        return jsonify({'sessionId': session_id}), 200

    except Exception as e:
        print(f"Error creating session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/sessions/<session_id>/trials', methods=['POST', 'OPTIONS'])
def save_trial(session_id):
    """Save trial data for a session"""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404

        data = request.json
        trial_id = str(uuid.uuid4())

        trial = {
            'trialId': trial_id,
            'sessionId': session_id,
            'timestamp': int(datetime.now().timestamp() * 1000),
            **data
        }

        trials.append(trial)

        # Update session
        sessions[session_id]['completedTrials'] += 1

        print(f"[{datetime.now().isoformat()}] Saved trial {trial_id} for session {session_id}")

        return jsonify({'trialId': trial_id}), 200

    except Exception as e:
        print(f"Error saving trial: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/sessions/<session_id>/complete', methods=['PUT', 'OPTIONS'])
def complete_session(session_id):
    """Mark a session as complete"""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404

        sessions[session_id]['status'] = 'completed'
        sessions[session_id]['endTime'] = int(datetime.now().timestamp() * 1000)

        print(f"[{datetime.now().isoformat()}] Completed session: {session_id}")

        return jsonify({'success': True}), 200

    except Exception as e:
        print(f"Error completing session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/statistics', methods=['GET', 'OPTIONS'])
def get_statistics():
    """Get aggregate statistics across all sessions"""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        # Compute statistics from trials
        by_category = defaultdict(lambda: {'fixation_times': [], 'counts': 0, 'first_fixations': []})
        by_scramble_method = defaultdict(lambda: {'fixation_times': [], 'counts': 0})
        by_scramble_level = defaultdict(lambda: {'fixation_times': [], 'counts': 0})

        for trial in trials:
            # Left image stats
            if 'leftImage' in trial and 'leftFixationTime' in trial:
                left_cat = trial['leftImage'].get('category', 'unknown')
                left_method = trial['leftImage'].get('scrambleMethod', 'unknown')
                left_level = str(trial['leftImage'].get('scrambleLevel', 0))
                left_fix = trial.get('leftFixationTime', 0)

                by_category[left_cat]['fixation_times'].append(left_fix)
                by_category[left_cat]['counts'] += 1
                by_category[left_cat]['first_fixations'].append(trial.get('firstFixation') == 'left')

                by_scramble_method[left_method]['fixation_times'].append(left_fix)
                by_scramble_method[left_method]['counts'] += 1

                by_scramble_level[left_level]['fixation_times'].append(left_fix)
                by_scramble_level[left_level]['counts'] += 1

            # Right image stats
            if 'rightImage' in trial and 'rightFixationTime' in trial:
                right_cat = trial['rightImage'].get('category', 'unknown')
                right_method = trial['rightImage'].get('scrambleMethod', 'unknown')
                right_level = str(trial['rightImage'].get('scrambleLevel', 0))
                right_fix = trial.get('rightFixationTime', 0)

                by_category[right_cat]['fixation_times'].append(right_fix)
                by_category[right_cat]['counts'] += 1
                by_category[right_cat]['first_fixations'].append(trial.get('firstFixation') == 'right')

                by_scramble_method[right_method]['fixation_times'].append(right_fix)
                by_scramble_method[right_method]['counts'] += 1

                by_scramble_level[right_level]['fixation_times'].append(right_fix)
                by_scramble_level[right_level]['counts'] += 1

        # Compute means
        def compute_means(data_dict):
            result = {}
            for key, value in data_dict.items():
                times = value['fixation_times']
                result[key] = {
                    'avgFixationTime': sum(times) / len(times) if times else 0,
                    'count': value['counts'],
                    'firstFixationRate': (sum(value.get('first_fixations', [])) /
                                         len(value.get('first_fixations', [1]))
                                         if value.get('first_fixations') else None)
                }
            return result

        stats = {
            'totalSessions': len(sessions),
            'totalTrials': len(trials),
            'byCategory': compute_means(by_category),
            'byScrambleMethod': compute_means(by_scramble_method),
            'byScrambleLevel': compute_means(by_scramble_level)
        }

        return jsonify(stats), 200

    except Exception as e:
        print(f"Error getting statistics: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/sessions', methods=['GET', 'OPTIONS'])
def get_sessions():
    """Get all sessions (for dashboard)"""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        return jsonify(list(sessions.values())), 200
    except Exception as e:
        print(f"Error getting sessions: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/export', methods=['GET', 'OPTIONS'])
def export_data():
    """Export all data (mock implementation)"""
    if request.method == 'OPTIONS':
        return '', 200

    try:
        export_data = {
            'sessions': list(sessions.values()),
            'trials': trials,
            'exportTime': datetime.now().isoformat()
        }

        return jsonify(export_data), 200

    except Exception as e:
        print(f"Error exporting data: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'sessions': len(sessions),
        'trials': len(trials),
        'timestamp': datetime.now().isoformat()
    }), 200


if __name__ == '__main__':
    print("="*60)
    print("Mock API Server for Gaze Tracking Experiment")
    print("="*60)
    print(f"Starting server at http://localhost:3000")
    print("Press Ctrl+C to stop")
    print("="*60)
    app.run(host='0.0.0.0', port=3000, debug=True)
