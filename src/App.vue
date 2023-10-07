<template>
  <audio
    ref="media"
    @loadedmetadata="flowchartStore.playbackDuration = $event.target.duration"
    @timeupdate="flowchartStore.playbackPosition = $event.target.currentTime"
    @stalled="flowchartStore.mediaBuffering = true"
    @loadeddata="flowchartStore.mediaBuffering = false"
    @playing="flowchartStore.mediaBuffering = false"
    @ended="stopPlayback(true)"
  >
    <source src="@/data/narration.m4a" type="audio/mp4" />
  </audio>
  <TheFlowchart
    @setCurrentNodeId="setCurrentNodeId"
    @jumpNarrationToNode="jumpNarrationToNode"
    @startPlayback="startPlayback"
    @startExplorationDuringPlayback="startExplorationDuringPlayback()"
    @stopExplorationDuringPlayback="stopExplorationDuringPlayback()"
    @hideChapterListAndIntroPanel="hideChapterListAndIntroPanel()"
    @mousedown="hideChapterListAndIntroPanel()"
  />
  <TheIntroPanel
    @togglePlayback="togglePlayback()"
    @toggleIntroPanel="toggleIntroPanel()"
  />
  <ThePlaybackControls
    @jumpNarrationToNode="jumpNarrationToNode"
    @jumpNarrationToChapter="jumpNarrationToChapter"
    @togglePlayback="togglePlayback()"
    @stopExplorationDuringPlayback="stopExplorationDuringPlayback()"
    @toggleChapterList="toggleChapterList()"
  />
  <TheFeedbackPrompt />
</template>

<script>
import { mapStores, mapActions } from 'pinia';

import TheFlowchart from '@/components/TheFlowchart.vue';
import TheIntroPanel from '@/components/TheIntroPanel.vue';
import ThePlaybackControls from '@/components/ThePlaybackControls.vue';
import TheFeedbackPrompt from '@/components/TheFeedbackPrompt.vue';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';
import { useViewStore } from '@/stores/ViewStore.js';
import { useFeedbackStore } from '@/stores/FeedbackStore.js';

export default {
  name: 'App',

  components: {
    TheFlowchart,
    TheIntroPanel,
    ThePlaybackControls,
    TheFeedbackPrompt
  },

  data() {
    return {
      // return to playback timeout reference and auto-return delay
      returnToPlaybackTimeout: undefined,
      returnToPlaybackDelay: 8000,

      // wakeLock support and reference
      wakeLockSupported: false,
      wakeLock: null
    }
  },

  computed: {
    ...mapStores(
      useFlowchartStore,
      useViewStore,
      useFeedbackStore
    )
  },

  methods: {
    ...mapActions(useFlowchartStore, [
      'saveToLocalStorage',
      'resumeFromLocalStorage'
    ]),
    ...mapActions(useFeedbackStore, [
      'disableLoggingIfQuerySet',
      'logEvent'
    ]),

    // update the current node ID
    setCurrentNodeId(nodeId) {
      this.flowchartStore.currentNodeId = nodeId;
      this.toggleChapterList(true);
      this.saveToLocalStorage();
    },

    // jump playback position to node (either current node or node clicked during playback)
    jumpNarrationToNode(nodeId) {
      const nodeOccurrencesInNarration = this.flowchartStore.narrationTimestamps.filter(event => event[0] === nodeId);

      if (nodeOccurrencesInNarration.length !== 0) {
        // if playback is active, jump to the next occurrence after the current playback position or the final one if none exists
        if (this.flowchartStore.playbackActive) {
          const nextNodeOccurrenceAfterPlaybackPosition = nodeOccurrencesInNarration.find(event => event[1] >= this.flowchartStore.playbackPosition);

          if (nextNodeOccurrenceAfterPlaybackPosition) {
            this.setPlaybackPosition(nextNodeOccurrenceAfterPlaybackPosition[1]);
          } else {
            const lastNodeOccurrence = nodeOccurrencesInNarration[nodeOccurrencesInNarration.length - 1];
            this.setPlaybackPosition(lastNodeOccurrence[1]);
          }
        // if playback is paused, jump to the first unlistened occurrence in narration sequence or the final one if none exists
        } else {
          let furthestNodeOccurrence = ['', 0];

          const noUnlistenedOccurrences = nodeOccurrencesInNarration.every(event => {
            if (this.flowchartStore.listenedTimestampIndexes.indexOf(this.flowchartStore.narrationTimestamps.indexOf(event)) === -1) {
              this.setPlaybackPosition(event[1]);
              return false;
            } else {
              furthestNodeOccurrence = event;
              return true;
            }
          });

          if (noUnlistenedOccurrences) {
            this.setPlaybackPosition(furthestNodeOccurrence[1]);
          }
        }
      } else {
        // if destination node does not occur within narration (happens when jump is triggered through node’s
        // click event while playback is active), stop playback and update the current node ID instead
        this.stopPlayback();
        this.setCurrentNodeId(nodeId);
      }

      this.logEvent('call_jumpNarrationToNode');
    },

    // jump playback position to chapter
    jumpNarrationToChapter(index) {
      this.setPlaybackPosition(this.flowchartStore.narrationChapters[index].timestamp);

      // if node of selected chapter is the same as the current narration node, this will not trigger
      // currentNarrationNodeId watcher -> therefore start playback manually
      if (this.flowchartStore.narrationChapters[index].id === this.flowchartStore.currentNarrationNodeId) {
        this.startPlayback();
      }

      this.logEvent('call_jumpNarrationToChapter');
    },

    // update current playback position and set currentTime of media to that position
    // (timeupdate event of media will keep updating playback position once ready/buffered)
    setPlaybackPosition(playbackPosition) {
      this.flowchartStore.playbackPosition = playbackPosition;
      this.$refs.media.currentTime = playbackPosition;
    },

    // start playback
    startPlayback(nodeIdAlreadySet = false) {
      if (!nodeIdAlreadySet) {
        this.setCurrentNodeId(this.flowchartStore.currentNarrationNodeId);
      }
      
      this.$refs.media.play();
      this.flowchartStore.playbackActive = true;
      this.requestWakeLock();
      this.hideChapterListAndIntroPanel();
    },

    // stop playback
    stopPlayback(openChapterList = false) {
      this.$refs.media.pause();
      this.flowchartStore.playbackActive = false;
      this.releaseWakeLock();
      this.stopExplorationDuringPlayback();
      
      if (openChapterList) {
        this.toggleChapterList();
      }
    },

    // toggle playback
    togglePlayback() {
      this.flowchartStore.playbackActive ? this.stopPlayback() : this.startPlayback();
    },

    // start exploration during playback and set timeout to return to playback location automatically
    startExplorationDuringPlayback() {
      this.flowchartStore.exploringDuringPlayback = true;
      clearTimeout(this.returnToPlaybackTimeout);

      this.returnToPlaybackTimeout = setTimeout(this.stopExplorationDuringPlayback, this.returnToPlaybackDelay);
    },

    // stop exploration during playback
    stopExplorationDuringPlayback() {
      this.flowchartStore.exploringDuringPlayback = false;
      clearTimeout(this.returnToPlaybackTimeout);
    },

    // toggle visibility of intro panel
    toggleIntroPanel(forceClose = false) {
      if (forceClose || this.viewStore.introPanelVisible) {
        this.viewStore.introPanelVisible = false;
      } else {
        this.viewStore.introPanelVisible = true;
        this.stopPlayback();
        this.toggleChapterList(true);
      }
    },

    // toggle visibility of chapter list
    toggleChapterList(forceClose = false) {
      if (forceClose || this.viewStore.chapterListVisible) {
        this.viewStore.chapterListVisible = false;
      } else {
        this.viewStore.chapterListVisible = true;
        this.toggleIntroPanel(true);
      }
    },

    // hide both chapter list and intro panel
    hideChapterListAndIntroPanel() {
      this.toggleChapterList(true);
      this.toggleIntroPanel(true);
    },

    // request and release wakeLock if supported
    async requestWakeLock() {
      if (this.wakeLockSupported) {
        try {
          this.wakeLock = await navigator.wakeLock.request('screen');
        } catch {
          // nevermind
        }
      }
    },
    async releaseWakeLock() {
      if (this.wakeLockSupported && this.wakeLock) {
        this.wakeLock.release().then(() => {
          this.wakeLock = null;
        })
      }
    }
  },

  created() {
    // generate unique session ID for logging
    this.feedbackStore.sessionId = new Date().getTime() + '_' + Math.random().toString(16).slice(2);
    
    // set wakeLockSupported if supported
    if ('wakeLock' in navigator) {
      this.wakeLockSupported = true;
    }

    // attempt to get state from previous session
    this.resumeFromLocalStorage();
  },

  mounted() {
    // if resumed from storage, set currentTime of media to playbackPosition from storage
    if (this.flowchartStore.resumedFromLocalStorage) {
      this.setPlaybackPosition(this.flowchartStore.playbackPosition);
    }

    // make spacebar trigger togglePlayback
    document.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Space') {
        event.preventDefault();
        
        this.togglePlayback();
        this.logEvent('input_spacebar');
      } else if (event.key === 'Enter' && this.flowchartStore.jumpActionAvailable) {
        event.preventDefault();

        this.jumpNarrationToNode(this.flowchartStore.currentNodeId);
        this.logEvent('input_enter');
      }
    });

    // log click events alongside the event targets’ DOM paths
    document.addEventListener('click', event => {
      const path = event.path || event.composedPath();
      
      const selectors = path.map(element => {
        element.classString = '';

        if (element.classList) {
          element.classList.forEach(className => {
            element.classString += '.' + className;
          });
        }

        return element.localName + (element.id ? '#' + element.id : '') + (element.classString ? element.classString : '');
      });

      this.logEvent('input_click', { eventTarget: selectors.toString() });
    });

    document.addEventListener('touchstart', () => {}, true);
  }
}
</script>

<style lang="scss">
@import '@/assets/normalize.css';
@import '@/assets/fonts.css';
@import '@/assets/variables.css';

body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--background-color);
}

#app {
  display: contents;
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  font-size: 15px;
  text-rendering: optimizeLegibility;
  color: #fff;
  -webkit-tap-highlight-color: rgba(0,0,0,0);
}

*:focus {
  outline: none;
}

*:focus-visible {
  box-shadow: 0 0 0 2px var(--background-color), 0 0 0 4px var(--focus-color) !important;
}
</style>