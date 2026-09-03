<template>
  <div class="app-container">
    <div class="sidebar">
      <div class="logo">LX</div>
      <div class="nav-item" :class="{ active: currentPage === 'search' }" @click="currentPage = 'search'">🔍</div>
      <div class="nav-item" :class="{ active: currentPage === 'love' }" @click="currentPage = 'love'">❤️</div>
      <div class="nav-item">🎵</div>
      <div class="nav-item">📊</div>
      <div class="nav-item">⚙️</div>
    </div>
    
    <div class="main-content">
      <template v-if="currentPage === 'search'" key="search">
        <div class="search-bar">
          <div class="search-container">
            <input 
              type="text" 
              v-model="searchQuery" 
              @keyup.enter="handleSearch"
              placeholder="搜索音乐..."
              class="search-input"
            >
            <button v-if="searchQuery" @click="clearSearch" class="clear-btn">✕</button>
            <button @click="handleSearch" class="search-btn">🔍</button>
          </div>
        </div>
      
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.value"
          @click="switchTab(tab.value)"
          :class="['tab', { active: currentTab === tab.value }]"
        >
          {{ tab.label }}
        </button>
      </div>
      
        <div class="results-container">
          <div v-if="isLoading" class="loading">
            搜索中...
          </div>
          
          <div v-else-if="searchResults.length === 0" class="no-results">
            {{ searchQuery ? '暂无搜索结果' : '请输入关键词搜索音乐' }}
          </div>
          
          <div v-else>
            <div class="search-results-header">
              <div>#</div>
              <div>Title</div>
              <div>Artist</div>
              <div>Album</div>
              <div>Length</div>
            </div>
            
            <div 
              v-for="(song, index) in paginatedSongs" 
              :key="song.songId"
              class="search-song-item"
              @dblclick="handleDoublePlay(song)"
            >
              <div class="song-number">{{ index + 1 }}</div>
              <div class="song-info">
                <span class="song-title">{{ song.name }}</span>
                <div class="song-tags">
                  <span v-if="song.source === 'tx'" class="tag tag-tx">TX</span>
                  <span v-if="song.source === 'wy'" class="tag tag-wy">WY</span>
                  <span v-if="song.source === 'kw'" class="tag tag-kw">KW</span>
                  <span v-if="song._types && (song._types['flac'] || song._types['320k'] || song._types['flac24bit'])" class="tag tag-sq">SQ</span>
                </div>
              </div>
              <div class="song-artist">{{ song.singer }}</div>
              <div class="song-album">{{ song.albumName }}</div>
              <div class="song-duration">{{ formatDuration(song.interval) }}</div>
            </div>
          </div>
        </div>
      </template>
      
      <template v-else-if="currentPage === 'love'" key="love">
        <div class="love-header">
          <h2>我的收藏</h2>
        </div>
        
        <div class="love-content">
          <div v-if="isLoading && !lovedSongs.length" class="loading">
            加载中...
          </div>
          
          <div v-else-if="lovedSongs.length === 0" class="no-results">
            暂无收藏歌曲
          </div>
          
          <div v-else>
            <div class="love-results-header">
              <div>#</div>
              <div>封面</div>
              <div>Title</div>
              <div>Artist</div>
              <div>Album</div>
              <div>Length</div>
            </div>
            
            <div 
               v-for="(song, index) in paginatedLovedSongs" 
               :key="song.songId"
               :class="['love-song-item', { 'love-playing': isSongPlaying(song), 'love-song-downloading': isSongBeingDownloaded(song) }]"
               @dblclick="playSongFromLove(song)"
               @contextmenu.prevent="showContextMenu($event, song.songId)"
             >
              <div class="song-number">
                <span v-if="isSongPlaying(song) && isPlaying" class="playing-indicator">♫</span>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <div class="song-cover">
                <img v-if="song.img" :src="song.img" class="cover-img" alt="Cover">
                <div v-else class="cover-placeholder">🎵</div>
              </div>
              <div class="song-title">{{ song.name || song.title }}</div>
              <div class="song-artist">{{ song.singer }}</div>
              <div class="song-album">{{ song.albumName }}</div>
              <div class="song-duration">{{ formatDuration(song.interval) }}</div>
            </div>
          </div>
        </div>
        
        <div 
          v-if="contextMenu.visible"
          class="context-menu"
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        >
          <div class="context-menu-item" @click="removeLovedSong(contextMenu.songId)">
            移除
          </div>
        </div>
      </template>
      
      <div class="player-bar" :class="{ 'player-bar--loading': isDownloading }" v-if="currentSong">
        <div class="player-info">
          <img v-if="currentSong.img" :src="currentSong.img" class="player-cover" alt="Cover">
          <div class="player-details">
            <div class="player-title">{{ currentSong.name }}</div>
            <div class="player-artist">{{ currentSong.singer }}</div>
            <div class="player-lyrics" v-if="currentLyricText">{{ currentLyricText }}</div>
          </div>
        </div>
        <div class="player-controls">
          <audio 
            ref="audioPlayer"
            :src="currentSongUrl"
            @play="onPlay"
            @pause="onPause"
            @ended="onEnded"
            @timeupdate="onTimeUpdate"
          ></audio>
          <div class="progress-container">
            <span class="current-time">{{ currentTime }}</span>
            <input 
              type="range" 
              v-model="progress" 
              :max="duration || 100"
              @input="onSeek"
              class="progress-bar"
            >
            <span class="total-time">{{ formatDuration(duration) }}</span>
          </div>
          <div class="volume-container">
            <button @click="toggleMute" class="volume-btn" title="静音">
              <svg v-if="isMuted || volume === 0" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-8-7-8l-1.65 1.65L18.5 10l1 1v1.5zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
              <svg v-else-if="volume < 0.5" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            </button>
            <input 
              type="range" 
              v-model.number="volume"
              min="0" 
              max="1" 
              step="0.01"
              @input="onVolumeChange"
              class="volume-slider"
            >
          </div>
          <div class="control-buttons">
            <button @click="prevSong" class="control-btn" title="上一曲" :disabled="isDownloading">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            <button @click="togglePlay" class="control-btn" title="{{ isPlaying ? '暂停' : '播放' }}" :disabled="isDownloading">
              <svg v-if="!isPlaying" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            </button>
            <button @click="nextSong" class="control-btn" title="下一曲" :disabled="isDownloading">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="download-overlay" v-if="isDownloading">
          <div class="download-spinner"></div>
          <span class="download-text">正在下载...</span>
        </div>
      </div>
      
      <transition name="lyrics">
        <div class="lyrics-container" v-if="currentSong && showLyrics">
          <button @click="toggleLyrics" class="lyrics-back-btn">←</button>
          <div class="lyrics-content" ref="lyricsContent">
            <div 
              v-for="(line, index) in displayLyrics" 
              :key="index"
              :class="['lyric-line', { active: line.originalIndex === currentLyricIndex }]"
              :style="{ opacity: getLineOpacity(line.originalIndex) }"
              @click="seekToLine(line.time)"
            >
              {{ line.text }}
            </div>
          </div>
        </div>
      </transition>
    </div>
    
    <div class="context-menu-overlay" 
         v-if="contextMenu.visible" 
         @click="hideContextMenu"
         @contextmenu.prevent="hideContextMenu"
    ></div>
  </div>
</template>

<script>
import path from 'path';

export default {
  name: 'App',
  data() {
    return {
      currentPage: 'search',
      searchQuery: '',
      currentTab: 'tx',
      searchResults: [],
      isLoading: false,
      allPage: 1,
      total: 0,
      pageSize: 100,
      tabs: [
        { label: 'TX Music', value: 'tx' },
        { label: 'NetEase', value: 'wy' },
        { label: 'Kuwo', value: 'kw' },
        { label: 'Aggregated', value: 'all' }
      ],
      currentSong: null,
      currentSongUrl: null,
      isPlaying: false,
      progress: 0,
      duration: 0,
      currentTime: '0:00',
      playlist: [],
      currentIndex: -1,
      showLyrics: false,
      lyrics: [],
      currentLyricIndex: -1,
      lyricsOffset: 0,
      lovedSongs: [],
      lovePageSize: 50,
      lovePlaylist: [],
      lovePlaylistIndex: -1,
      isDownloading: false,
      downloadingSongIds: new Set(),
      volume: 1,
      isMuted: false,
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        songId: null
      }
    };
  },
  mounted() {
    this.loadLovedSongs();
  },
  watch: {
    currentPage(newPage) {
      if (newPage === 'love') {
        this.loadLovedSongs();
      }
    }
  },
  computed: {
    paginatedSongs() {
      return this.searchResults.slice(0, this.pageSize);
    },
    paginatedLovedSongs() {
      return this.lovedSongs.slice(0, this.lovePageSize);
    },
    isBeingDownloaded() {
      if (!this.currentSong || !this.currentSong.songId) return false;
      return this.downloadingSongIds.has(String(this.currentSong.songId));
    },
    currentLyricText() {
      if (this.currentLyricIndex >= 0 && this.currentLyricIndex < this.lyrics.length) {
        return this.lyrics[this.currentLyricIndex].text;
      }
      return '';
    },
    displayLyrics() {
      if (!this.lyrics || this.lyrics.length === 0) return [];
      
      const visibleCount = 15;
      let startIndex = Math.max(0, this.currentLyricIndex - Math.floor(visibleCount / 2));
      let endIndex = Math.min(this.lyrics.length, startIndex + visibleCount);
      
      if (this.currentLyricIndex >= endIndex - 1) {
        startIndex = Math.max(0, endIndex - visibleCount);
      }
      
      return this.lyrics.slice(startIndex, endIndex).map((line, i) => ({
        ...line,
        originalIndex: startIndex + i
      }));
    }
  },
  methods: {
    async handleSearch() {
      if (!this.searchQuery.trim()) return;
      
      this.isLoading = true;
      this.searchResults = [];
      
      try {
        if (this.currentTab === 'all') {
          const sources = this.tabs.filter(tab => tab.value !== 'all').map(tab => tab.value);
          const results = await Promise.all(sources.map(source =>
            fetch(`/api/music/search?q=${encodeURIComponent(this.searchQuery)}&page=1&limit=50&source=${source}`)
              .then(res => res.json())
          ));

          this.searchResults = results.flatMap(data => data.list || []);
          this.total = results.reduce((sum, data) => sum + (data.total || 0), 0);
          this.allPage = 1;
        } else {
          const source = this.currentTab;
          const url = `/api/music/search?q=${encodeURIComponent(this.searchQuery)}&page=1&limit=100&source=${source}`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data && data.list) {
            this.searchResults = data.list;
            this.total = data.total || 0;
            this.allPage = data.allPage || 1;
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        this.isLoading = false;
      }
    },
    async loadLovedSongs() {
      try {
        const response = await fetch('/api/music/loved');
        const data = await response.json();
        
        if (data.success) {
          this.lovedSongs = data.songs || [];
          this.lovePlaylist = [...this.lovedSongs];
          this.lovePlaylistIndex = -1;
        }
      } catch (error) {
        console.error('Error loading loved songs:', error);
      }
    },
    clearSearch() {
      this.searchQuery = '';
      this.searchResults = [];
    },
    switchTab(tabValue) {
      this.currentTab = tabValue;
      if (this.searchQuery.trim()) {
        this.handleSearch();
      }
    },
    formatDuration(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00';
      const minutes = Math.floor(seconds / 60);
      const remainderSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainderSeconds.toString().padStart(2, '0')}`;
    },
    isSongPlaying(song) {
      if (!this.currentSong || !song.songId) return false;
      const currentId = String(this.currentSong.songId);
      const songId = String(song.songId);
      return currentId === songId;
    },
    isSongBeingDownloaded(song) {
      if (!song || !song.songId) return false;
      return this.downloadingSongIds.has(String(song.songId));
    },
    async handleDoublePlay(song) {
      await this.downloadAndPlaySong(song);
    },
  async playSongFromLove(song) {
      if (this.downloadingSongIds.has(String(song.songId))) {
        this.currentSong = song;
        this.currentSongUrl = null;
        this.isPlaying = false;
        this.progress = 0;
        this.currentTime = '0:00';
        this.duration = 0;
        this.showLyrics = false;
        this.currentLyricIndex = -1;
        this.lyrics = [];
        return;
      }
      
      if (this.currentSong?.songId === song.songId && this.isPlaying) {
        this.togglePlay();
        return;
      }
      
      const index = this.lovedSongs.findIndex(s => s.songId === song.songId);
      if (index !== -1) {
        this.lovedPlaylist = [...this.lovedSongs.slice(index), ...this.lovedSongs.slice(0, index)];
        this.lovePlaylistIndex = index;
      }
      
      this.currentSong = song;
      this.isPlaying = false;
      this.progress = 0;
      this.currentTime = '0:00';
      this.showLyrics = false;
      this.currentLyricIndex = -1;
      this.lyrics = [];
      
      await this.playSongWithLyrics(song);
    },
  async fetchLyrics(songId, strMediaMid, songmid, source) {
    const lyricUrl = `/api/music/lyric?songId=${encodeURIComponent(songId || '')}&strMediaMid=${encodeURIComponent(strMediaMid || '')}&songmid=${encodeURIComponent(songmid || '')}&source=${source}`;
    
    try {
      const response = await fetch(lyricUrl);
      if (!response.ok) {
        console.warn('Failed to fetch lyrics:', response.status);
        this.lyrics = [];
        return;
      }
      const data = await response.json();
      if (data && data.success && data.lyrics) {
        this.lyrics = data.lyrics;
        this.$nextTick(() => {
          this.scrollToCurrentLine();
        });
      } else {
        this.lyrics = [];
      }
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      this.lyrics = [];
    }
  },
    onPlay() {
      this.isPlaying = true;
    },
    onPause() {
      this.isPlaying = false;
    },
    onEnded() {
      this.isPlaying = false;
      this.progress = 0;
      this.currentTime = '0:00';
      this.playNextLoveSong();
    },
    onTimeUpdate() {
      const audio = this.$refs.audioPlayer;
      if (audio) {
        this.progress = audio.currentTime;
        this.currentTime = this.formatDuration(audio.currentTime);
        this.duration = audio.duration;
        
        if (this.lyrics.length > 0) {
          this.updateLyricIndex(audio.currentTime);
        }
      }
    },
    updateLyricIndex(time) {
      for (let i = 0; i < this.lyrics.length; i++) {
        if (time < this.lyrics[i].time) {
          this.currentLyricIndex = i - 1;
          break;
        }
        if (i === this.lyrics.length - 1) {
          this.currentLyricIndex = i;
        }
      }
    },
    onSeek() {
      const audio = this.$refs.audioPlayer;
      if (audio && this.duration) {
        audio.currentTime = this.progress;
      }
    },
    togglePlay() {
      const audio = this.$refs.audioPlayer;
      if (audio) {
        if (this.isPlaying) {
          audio.pause();
        } else {
          audio.play();
        }
      }
    },
    onVolumeChange() {
      const audio = this.$refs.audioPlayer;
      if (audio) {
        audio.volume = this.volume;
      }
      if (this.volume > 0) {
        this.isMuted = false;
        const audio = this.$refs.audioPlayer;
        if (audio) {
          audio.muted = false;
        }
      }
    },
    toggleMute() {
      const audio = this.$refs.audioPlayer;
      if (!audio) return;
      this.isMuted = !this.isMuted;
      audio.muted = this.isMuted;
      if (this.isMuted) {
        audio.volume = this.volume;
      } else if (audio.volume === 0) {
        audio.volume = this.volume || 1;
      }
    },
    prevSong() {
      if (this.lovePlaylist.length > 0) {
        this.lovePlaylistIndex = (this.lovePlaylistIndex - 1 + this.lovePlaylist.length) % this.lovePlaylist.length;
        const prevSong = this.lovePlaylist[this.lovePlaylistIndex];
        this.playSongFromLove(prevSong);
      }
    },
    nextSong() {
      if (this.lovePlaylist.length > 0) {
        this.lovePlaylistIndex = (this.lovePlaylistIndex + 1) % this.lovePlaylist.length;
        const nextSong = this.lovePlaylist[this.lovePlaylistIndex];
        this.playSongFromLove(nextSong);
      }
    },
    playNextLoveSong() {
      if (this.lovePlaylist.length > 0) {
        this.lovePlaylistIndex = (this.lovePlaylistIndex + 1) % this.lovePlaylist.length;
        const nextSong = this.lovePlaylist[this.lovePlaylistIndex];
        this.playSongFromLove(nextSong);
      }
    },
    
   scrollToCurrentLine() {
      const lyricsContent = this.$refs.lyricsContent;
      if (!lyricsContent || this.currentLyricIndex < 0) return;
      
      const activeLine = lyricsContent.querySelectorAll('.lyric-line')[this.currentLyricIndex];
      if (activeLine) {
        const lineHeight = activeLine.offsetHeight || 30;
        const containerHeight = lyricsContent.offsetHeight;
        const scrollPos = this.currentLyricIndex * lineHeight - containerHeight / 2 + lineHeight / 2;
        
        lyricsContent.scrollTop = scrollPos;
      }
    },
    getLineOpacity(index) {
      if (index === this.currentLyricIndex) return 1;
      if (index === this.currentLyricIndex - 1 || index === this.currentLyricIndex + 1) return 0.7;
      if (index === this.currentLyricIndex - 2 || index === this.currentLyricIndex + 2) return 0.5;
      return 0.3;
    },
    seekToLine(time) {
      const audio = this.$refs.audioPlayer;
      if (audio) {
        audio.currentTime = time;
      }
    },
    toggleLyrics() {
      this.showLyrics = false;
    },
    async downloadAndPlaySong(song) {
      const songData = {
        songId: song.songId,
        strMediaMid: song.strMediaMid || '',
        songmid: song.songmid || '',
        source: song.source || 'tx',
        name: song.name,
        singer: song.singer,
        albumName: song.albumName,
        interval: song.interval,
        img: song.img
      };
      
      this.downloadingSongIds.add(String(song.songId));
      this.currentSong = song;
      this.isPlaying = false;
      this.progress = 0;
      this.currentTime = '0:00';
      this.showLyrics = false;
      this.currentLyricIndex = -1;
      this.lyrics = [];
      this.currentSongUrl = null;
      this.isDownloading = true;
      
      try {
        const response = await fetch('/api/music/love', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            song: songData,
            source: song.source || 'tx'
          })
        });
        
        if (!response.ok) {
          throw new Error('保存失败');
        }
        
        const saveData = await response.json();
        console.log('[Frontend] Saved successfully:', saveData);
        
        const savedSong = saveData.song;
        await this.playSongWithLyrics(savedSong);
      } catch (error) {
        console.error('Save and play error:', error);
        alert('保存和播放失败：' + error.message);
      } finally {
        this.isDownloading = false;
        this.downloadingSongIds.delete(String(song.songId));
        await this.loadLovedSongs();
      }
    },
   async playSong(song) {
      await this.playSongWithLyrics(song);
    },
    async playSongWithLyrics(song) {
      if (this.currentSong?.songId === song.songId && this.isPlaying) {
        this.togglePlay();
        return;
      }
      
      console.log('[Frontend] playSongWithLyrics called with:', {
        songId: song.songId,
        musicUrl: song.musicUrl,
        musicFilename: song.musicFilename,
        lyricFilename: song.lyricFilename
      });
      
      const index = this.lovedSongs.findIndex(s => s.songId === song.songId);
      if (index !== -1 && this.currentPage === 'love') {
        this.lovedPlaylist = [...this.lovedSongs.slice(index), ...this.lovedSongs.slice(0, index)];
        this.lovePlaylistIndex = index;
      }
      
      this.currentSong = song;
      this.isPlaying = false;
      this.progress = 0;
      this.currentTime = '0:00';
      this.showLyrics = false;
      this.currentLyricIndex = -1;
      this.lyrics = [];
      
      let musicUrl = song.musicUrl;
      
      if (!musicUrl && song.musicFilename) {
        musicUrl = `/downloads/${song.musicFilename}`;
        console.log('[Frontend] Using musicFilename:', song.musicFilename);
      }
      
      if (!musicUrl) {
        try {
          const response = await fetch(
            `/api/music/url?songId=${encodeURIComponent(song.songId || '')}&strMediaMid=${encodeURIComponent(song.strMediaMid || '')}&songmid=${encodeURIComponent(song.songmid || '')}&source=${song.source || 'tx'}&quality=320k`
          );
          const musicUrlData = await response.json();
          musicUrl = typeof musicUrlData === 'string' ? musicUrlData : (musicUrlData.url || musicUrlData);
          
          if (!musicUrl) {
            throw new Error('No music URL available');
          }
          
          console.log('[Frontend] Final musicUrl:', musicUrl);
          this.currentSongUrl = musicUrl;
          await this.loadLyricsFromFile(song.lyricUrl);
          
          this.$nextTick(() => {
            if (this.$refs.audioPlayer) {
              this.$refs.audioPlayer.load();
              this.$refs.audioPlayer.play();
            }
          });
        } catch (error) {
          console.error('Play error:', error);
          alert('播放失败：' + error.message);
        }
      } else {
        console.log('[Frontend] Final musicUrl:', musicUrl);
        this.currentSongUrl = musicUrl;
        
        await this.loadLyricsFromFile(song.lyricUrl);
        
        this.$nextTick(() => {
          if (this.$refs.audioPlayer) {
            this.$refs.audioPlayer.load();
            this.$refs.audioPlayer.play();
          }
        });
      }
    },
    async loadLyricsFromFile(lyricUrl) {
      if (!lyricUrl) {
        console.log('[Frontend] No lyric URL available');
        this.lyrics = [];
        return;
      }
      
      try {
        const response = await fetch(lyricUrl);
        if (!response.ok) {
          console.warn('[Frontend] Failed to load lyric file:', response.status);
          this.lyrics = [];
          return;
        }
        
        const lyricText = await response.text();
        this.lyrics = this.parseLyricText(lyricText);
        console.log('[Frontend] Loaded lyrics:', this.lyrics.length, 'lines');
        
        this.$nextTick(() => {
          this.scrollToCurrentLine();
        });
      } catch (error) {
        console.error('[Frontend] Error loading lyrics:', error);
        this.lyrics = [];
      }
    },
    showContextMenu(event, songId) {
      this.contextMenu.songId = songId;
      this.contextMenu.x = event.clientX;
      this.contextMenu.y = event.clientY;
      this.contextMenu.visible = true;
    },
    hideContextMenu() {
      this.contextMenu.visible = false;
    },
    async removeLovedSong(songId) {
      try {
        const response = await fetch(`/api/music/loved/${songId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error('删除失败');
        }
        
        const data = await response.json();
        if (data.success) {
          this.lovedSongs = this.lovedSongs.filter(s => s.songId != songId && String(s.songId) !== String(songId));
          this.lovePlaylist = this.lovedSongs;
          
          if (this.currentSong && (this.currentSong.songId == songId || String(this.currentSong.songId) === String(songId))) {
            this.currentSong = null;
            this.currentSongUrl = null;
            if (this.$refs.audioPlayer) {
              this.$refs.audioPlayer.pause();
            }
          }
        }
      } catch (error) {
        console.error('Error removing song:', error);
      } finally {
        this.hideContextMenu();
      }
    },
    parseLyricText(lyricText) {
      const lines = lyricText.split('\n');
      const parsedLyrics = [];
      
      const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
      
      lines.forEach((line, index) => {
        const match = line.match(timeRegex);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
          const time = minutes * 60 + seconds + milliseconds / 1000;
          const text = line.replace(timeRegex, '').trim();
          
          if (text) {
            parsedLyrics.push({
              time: time,
              text: text,
              originalIndex: index
            });
          }
        }
      });
      
      return parsedLyrics;
    }
  }
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f5f5;
  color: #333;
}

.app-container {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 60px;
  background-color: #e8f5e9;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
}

.logo {
  font-size: 24px;
  font-weight: bold;
  color: #4caf50;
  margin-bottom: 30px;
  letter-spacing: 2px;
}

.nav-item {
  width: 40px;
  height: 40px;
  margin-bottom: 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  color: #666;
  font-size: 20px;
}

.nav-item:hover, .nav-item.active {
  background-color: #c8e6c9;
  color: #4caf50;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.search-bar {
  padding: 20px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.search-container {
  display: flex;
  gap: 10px;
  max-width: 600px;
  margin: 0 auto;
}

.search-input {
  flex: 1;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s;
}

.search-input:focus {
  border-color: #4caf50;
}

.search-btn, .clear-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.search-btn {
  background-color: #4caf50;
  color: white;
}

.search-btn:hover {
  background-color: #45a049;
}

.clear-btn {
  background-color: #f0f0f0;
  color: #666;
}

.clear-btn:hover {
  background-color: #e0e0e0;
}

.tabs {
  display: flex;
  gap: 0;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  overflow-x: auto;
}

.tab {
  padding: 12px 20px;
  cursor: pointer;
  border: none;
  background: none;
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  transition: all 0.3s;
  border-bottom: 2px solid transparent;
}

.tab:hover {
  color: #4caf50;
}

.tab.active {
  color: #4caf50;
  border-bottom-color: #4caf50;
}

.results-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.search-results-header {
  display: grid;
  grid-template-columns: 40px 300px 100px 100px 60px;
  gap: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 12px;
  color: #666;
}

.love-results-header {
  display: grid;
  grid-template-columns: 40px 40px 130px 100px 100px 60px;
  gap: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 12px;
  color: #666;
}

.search-song-item {
  display: grid;
  grid-template-columns: 40px 300px 100px 100px 60px;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
  align-items: center;
}

.love-song-item {
  display: grid;
  grid-template-columns: 40px 40px 130px 100px 100px 60px;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
  align-items: center;
}

.search-song-item:hover {
  background-color: #4caf50;
  color: white;
}

.search-song-item:hover .song-title,
.search-song-item:hover .song-artist,
.search-song-item:hover .song-album,
.search-song-item:hover .song-duration,
.search-song-item:hover .song-number {
  color: white;
}

.search-song-item:hover .tag {
  background-color: rgba(255, 255, 255, 0.3);
  color: white;
}

.love-song-item:hover {
  background-color: #4caf50;
  color: white;
}

.love-song-item:hover .song-title,
.love-song-item:hover .song-artist,
.love-song-item:hover .song-album,
.love-song-item:hover .song-duration,
.love-song-item:hover .song-number {
  color: white;
}

.love-song-item.love-playing {
  background-color: #ff6f00;
  color: white;
  box-shadow: 0 2px 12px rgba(255, 111, 0, 0.5);
}

.love-song-item.love-playing .song-title,
.love-song-item.love-playing .song-artist,
.love-song-item.love-playing .song-album,
.love-song-item.love-playing .song-duration {
  color: white;
}

.love-song-item.love-song-downloading {
  opacity: 0.5;
  filter: grayscale(0.8);
  cursor: not-allowed;
}

.love-song-item.love-song-downloading:hover {
  background-color: #f0f0f0;
}

.love-song-item.love-song-downloading .song-title,
.love-song-item.love-song-downloading .song-artist,
.love-song-item.love-song-downloading .song-album,
.love-song-item.love-song-downloading .song-duration {
  color: #999;
}

.love-song-item.love-song-downloading .song-cover {
  filter: grayscale(0.8);
  opacity: 0.7;
}

.love-song-item.love-song-downloading .playing-indicator {
  display: none;
}

.playing-indicator {
  color: #ffeb3b;
  font-size: 16px;
  font-weight: bold;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.song-number {
  color: #999;
  font-size: 14px;
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #ddd;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background-color: #ddd;
}

.song-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.song-title {
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-tags {
  display: flex;
  gap: 5px;
}

.tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
}

.tag-sq {
  background-color: #4caf50;
}

.tag-kg {
  background-color: #2196f3;
}

.tag-tx {
  background-color: #ff9800;
}

.tag-wy {
  background-color: #e91e63;
}

.tag-kw {
  background-color: #009688;
}

.song-artist {
  font-size: 13px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-album {
  font-size: 13px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-duration {
  font-size: 13px;
  color: #999;
  text-align: right;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #999;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: #999;
}

.player-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background-color: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  height: 70px;
  position: relative;
}

.player-bar--loading {
  filter: grayscale(1) brightness(0.85);
  pointer-events: none;
  user-select: none;
  opacity: 0.7;
}

.download-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  z-index: 10;
}

.download-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #ccc;
  border-top-color: #4caf50;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.download-text {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 200px;
}

.player-cover {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
  background-color: #ddd;
}

.player-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.player-artist {
  font-size: 12px;
  color: #666;
}

.player-lyrics {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.player-controls {
  flex: 2;
  display: flex;
  align-items: center;
  gap: 15px;
}

.volume-container {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 120px;
}

.volume-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: #666;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;
}

.volume-btn:hover {
  color: #4caf50;
  background-color: rgba(76, 175, 80, 0.1);
}

.volume-btn svg {
  width: 20px;
  height: 20px;
}

.volume-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #4caf50;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #4caf50;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.volume-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.progress-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.current-time, .total-time {
  font-size: 12px;
  color: #666;
  min-width: 40px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 2px;
  outline: none;
}

.progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #4caf50;
  border-radius: 50%;
  cursor: pointer;
}

.progress-bar::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #4caf50;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.control-buttons {
  display: flex;
  gap: 10px;
}

.control-btn {
  width: 40px;
  height: 40px;
  border: none;
  background-color: #4caf50;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s;
  padding: 0;
}

.control-btn:hover {
  background-color: #45a049;
}

.control-btn svg {
  width: 24px;
  height: 24px;
}

  .lyrics-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}



.lyrics-enter-active,
.lyrics-leave-active {
  transition: all 0.3s ease;
}

.lyrics-enter-from,
.lyrics-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.lyrics-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  padding: 40px 60px;
  text-align: center;
}

.lyric-line {
  font-size: 18px;
  line-height: 2;
  color: #999;
  padding: 8px 20px;
  margin: 5px 0;
  border-radius: 8px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.lyric-line:hover {
  background-color: rgba(76, 175, 80, 0.1);
}

.lyric-line.active {
  color: #4caf50;
  font-size: 22px;
  font-weight: 600;
  transform: scale(1.05);
  background-color: rgba(76, 175, 80, 0.15);
}

.lyrics-back-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f5f5f5;
  border: none;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 1001;
}

.lyrics-back-btn:hover {
  background-color: #e0e0e0;
}

.love-header {
  padding: 20px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.love-header h2 {
  font-size: 24px;
  color: #333;
  margin: 0;
}

.love-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #ddd;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background-color: #ddd;
}

.context-menu {
  position: fixed;
  z-index: 10000;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 120px;
}

.context-menu-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background-color: #f5f5f5;
  color: #4caf50;
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}
</style>
