import { defineStore } from 'pinia';

import narrationTimestamps from '@/data/timestamps.json';

export const useFlowchartStore = defineStore('flowchart', {
  state: () => ({
    // language
    flowchartLanguage: 'en',

    // nodes and their state
    flowchartNodes: {},
    currentNodeId: 'n001',
    teasedItems: [],
    revealedItems: [],

    // narration/timestamps and their state
    narrationTimestamps,
    listenedTimestampIndexes: [],
    narrationChapters: [],
    listenedChapterIndexes: [],

    // state of playback
    playbackDuration: 0,
    playbackPosition: 0,
    playbackActive: false,
    mediaBuffering: false,

    // state of exploration during playback
    exploringDuringPlayback: false,

    // state of resumption from local storage
    storedProperties: [
      'currentNodeId',
      'teasedItems',
      'revealedItems',
      'listenedTimestampIndexes',
      'listenedChapterIndexes',
      'playbackPosition'
    ],
    resumedFromLocalStorage: false,
    resetActionAvailable: false
  }),
  getters: {
    storageKey() {
      return 'flowchart_' + this.flowchartLanguage;
    },
    // playback progress as percentage (with minimum value for initial progress bar visibility)
    playbackProgress(state) {
      if (state.playbackDuration !== 0 && state.playbackPosition !== 0) {
        return Math.max(Math.round(state.playbackPosition / state.playbackDuration * 1000) / 1000, 0.015);
      } else {
        return 0;
      }
    },
    // formatted playback duration (mm:ss)
    prettyPlaybackDuration(state) {
      return formatTime(state.playbackDuration);
    },
    // formatted playback position (mm:ss)
    prettyPlaybackPosition(state) {
      return formatTime(state.playbackPosition);
    },
    // current node object
    currentNode(state) {
      return state.flowchartNodes[state.currentNodeId];
    },
    // current index in narrationTimestamps based on media playback position
    currentNarrationNodeIndex(state) {
      const nextNarrationNodeIndex = state.narrationTimestamps.findIndex(event => event[1] > state.playbackPosition);

      if (nextNarrationNodeIndex === -1) {
        // no more narration events after playback position, thus return last index
        return Math.max(state.narrationTimestamps.length - 1, 0);
      } else {
        // return the current index (subsequent index minus one)
        return Math.max(nextNarrationNodeIndex - 1, 0);
      }
    },
    // current narration node ID
    currentNarrationNodeId(state) {
      return state.narrationTimestamps[this.currentNarrationNodeIndex][0];
    },
    // current narration node object
    currentNarrationNode(state) {
      return state.flowchartNodes[this.currentNarrationNodeId];
    },
    // current chapter index based on playback position
    currentNarrationChapterIndex(state) {
      const nextNarrationChapterIndex = state.narrationChapters.findIndex(chapter => chapter.timestamp > state.playbackPosition);

      if (nextNarrationChapterIndex === -1) {
        return Math.max(state.narrationChapters.length - 1, 0);
      } else {
        return Math.max(nextNarrationChapterIndex - 1, 0);
      }
    },
    // current chapter object
    currentNarrationChapter(state) {
      return state.narrationChapters[this.currentNarrationChapterIndex];
    },
    // determines whether current node has moved away from narration (i.e. current node differs from current narration node)
    movedAwayFromNarration(state) {
      return !state.playbackActive && state.currentNodeId !== this.currentNarrationNodeId;
    },
    // determines whether jump action is available (i.e. if jumpNarrationToNode action can be triggered from current node)
    jumpActionAvailable(state) {
      return this.movedAwayFromNarration && state.narrationTimestamps.findIndex(event => event[0] === state.currentNodeId) !== -1;
    },
    // determines whether feedback prompt is visible (revealed after threshold of revealed items has been reached)
    feedbackPromptAvailable() {
      return this.revealedItems.length >= 64;
    },
  },
  actions: {
    // save all parameters relevant for restoring the state of the chart to local storage
    saveToLocalStorage() {
      const currentState = {};

      this.storedProperties.forEach((property) => {
        currentState[property] = this[property];
      });

      localStorage.setItem(this.storageKey, JSON.stringify(currentState));
    },
    // attempt to get state from previous session
    resumeFromLocalStorage() {
      if (localStorage.getItem(this.storageKey)) {
        this.resumedFromLocalStorage = true;
        this.resetActionAvailable = true;

        const restoredState = JSON.parse(localStorage.getItem(this.storageKey));

        this.storedProperties.forEach((property) => {
          this[property] = restoredState[property];
        });
      }
    },
    // clear local storage and reload the page
    clearStorageKeyAndReload() {
      localStorage.removeItem(this.storageKey);
      location.reload();
    }
  }
});

function formatTime(seconds) {
  seconds = Math.floor(seconds);
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');

  return minutes + ':' + remainder;
}