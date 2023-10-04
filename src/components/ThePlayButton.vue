<template>
  <div>
    <PrimaryButton
      :state="!flowchartStore.movedAwayFromNarration ? 'highlighted' : ''"
      :icon="buttonIcon"
      :title="buttonTitle"
    />
    <svg width="64" height="64">
      <circle
        r="30.5"
        cx="32"
        cy="32"
        stroke-width="3"
        :stroke-dasharray="progressCircumference + ' ' +  progressCircumference"
        :stroke-dashoffset="progressOffset"
      />
    </svg>
  </div>
</template>

<script>
import { mapStores } from 'pinia';

import PrimaryButton from '@/components/PrimaryButton.vue';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';

export default {
  name: 'ThePlayButton',

  components: {
    PrimaryButton
  },

  data() {
    return {
      progressCircumference: 30.5 * 2 * Math.PI
    }
  },

  computed: {
    ...mapStores(
      useFlowchartStore
    ),
    progressOffset() {
      return this.progressCircumference - this.flowchartStore.playbackProgress * this.progressCircumference;
    },
    buttonIcon() {
      if (this.flowchartStore.mediaBuffering) {
        return 'buffering';
      } else if (!this.flowchartStore.playbackActive) {
        return 'play';
      } else if (this.flowchartStore.exploringDuringPlayback) {
        return 'return';
      } else {
        return 'pause';
      }
    },
    buttonTitle() {
      if (this.flowchartStore.mediaBuffering) {
        return 'Narration audio loading…';
      } else if (!this.flowchartStore.playbackActive) {
        return 'Resume narration playback';
      } else if (this.flowchartStore.exploringDuringPlayback) {
        return 'Return to playback location';
      } else {
        return 'Pause narration playback';
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/variables.css';

div {
  pointer-events: none;
  transition: transform var(--transition-duration) var(--transition-timing);

  &:hover {
    transform: scale(1.0625);
  }
}

button {
  display: block;
  pointer-events: all;

  &:hover {
    transform: none;
  }
}

svg {
  position: absolute;
  bottom: 0;
  transform: rotate(-90deg);

  circle {
    fill: transparent;
    stroke: #fff;
    transition: stroke-dashoffset var(--transition-duration) var(--transition-timing);
  }
}
</style>