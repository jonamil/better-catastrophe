import { defineStore } from 'pinia';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';
import { useViewStore } from '@/stores/ViewStore.js';

export const useFeedbackStore = defineStore('feedback', {
  state: () => ({
    loggingUrl: './log.php',
    formUrl: 'https://tally.so/r/wvr1AD'
  }),
  actions: {
    // log an event via a post request
    logEvent(eventType, additionalData = {}) {
      if (window.location.search === '?nolog') {
        return;
      }

      const flowchartStore = useFlowchartStore();
      const viewStore = useViewStore();

      const currentState = {
        nodeId: flowchartStore.currentNodeId,
        narrationNodeIndex: flowchartStore.currentNarrationNodeIndex,
        narrationChapterIndex: flowchartStore.currentNarrationChapterIndex,
        playbackActive: +flowchartStore.playbackActive,
        playbackPosition: flowchartStore.playbackPosition,
        exploringDuringPlayback: +flowchartStore.exploringDuringPlayback,
        chapterListVisible: +viewStore.chapterListVisible,
        introPanelVisible: +viewStore.introPanelVisible
      };

      fetch(this.loggingUrl, {
        method: 'post',
        body: JSON.stringify({
          eventType,
          session: this.sessionId,
          timestamp: Math.round(performance.now()),
          ...currentState,
          ...additionalData
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(error => {
        console.log(error);
      });
    }
  }
});