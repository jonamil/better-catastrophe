<template>
  <div class="feedback" :class="{ visible: feedbackPromptAvailable }">
    <div class="prompt" :class="{ attention: drawAttention }">
      <span>Thank you for trying out the flowchart interface! Please help our research by filling out this short feedback form.</span>
    </div>
    <PrimaryButton
      icon="feedback"
      title="Fill out feedback form"
      @click="openForm()"
    />
  </div>
</template>

<script>
import { mapState } from 'pinia';

import PrimaryButton from '@/components/PrimaryButton.vue';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';
import { useFeedbackStore } from '@/stores/FeedbackStore.js';

export default {
  name: 'TheFeedbackPrompt',

  components: {
    PrimaryButton
  },

  data() {
    return {
      drawAttention: false
    }
  },

  computed: {
    ...mapState(useFlowchartStore, [
      'feedbackPromptAvailable'
    ]),
    ...mapState(useFeedbackStore, [
      'formUrl'
    ])
  },

  methods: {
    openForm() {
      window.open(this.formUrl, '_blank');
    },
  },

  watch: {
    feedbackPromptAvailable() {
      this.drawAttention = true;

      setTimeout(() => {
        this.drawAttention = false;
      }, 6500);
    }
  }
}
</script>

<style lang="scss">
@import '@/assets/variables.css';

.feedback {
  position: absolute;
  visibility: hidden;
  opacity: 0;
  top: 16px;
  left: 96px;
  right: 16px;
  text-align: right;
  pointer-events: none;
  transition: all 1s var(--transition-timing);

  &.visible {
    visibility: visible;
    opacity: 1;
  }

  &:hover .prompt, .prompt.attention {
    width: 330px;
  }

  .prompt {
    position: relative;
    display: inline-block;
    overflow: hidden;
    width: 64px;
    height: 64px;
    border-radius: 32px;
    color: rgba(255,255,255,0.5);
    background: rgba(90,90,90,0.75);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    box-shadow: 0 0 0 2px var(--background-color);
    transition: all var(--transition-duration) var(--transition-timing);

    span {
      position: absolute;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      right: 0;
      width: 330px;
      height: 64px;
      padding: 0 72px 2px 28px;
      text-align: left;
      font-size: 13px;
      line-height: 16px;
    }
  }
  
  button {
    position: absolute;
    display: inline-block;
    right: 0;
    pointer-events: all;
  }
}

@media (max-width: 441px) {
  .feedback .prompt {
    display: none;
  }
}
</style>