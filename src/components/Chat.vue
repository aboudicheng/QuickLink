<template>
  <div>
    <a-modal title="Upload" v-model="isModalOpen" @ok="handleOk">
      <a-upload-dragger
        name="file"
        action="https://www.mocky.io/v2/5cc8019d300000980a055e76"
        :beforeUpload="beforeUpload"
        @change="handleFileChange"
        :multiple="false"
        :fileList="fileList"
      >
        <p class="ant-upload-drag-icon">
          <a-icon type="inbox" />
        </p>
        <p class="ant-upload-text">Click or drag file to this area to upload</p>
        <p class="ant-upload-hint">Supports PNG/JPEG image files within 5MB</p>
      </a-upload-dragger>
      <template slot="footer">
        <a-button key="back" @click="handleCancel">Back</a-button>
      </template>
    </a-modal>
    <div class="center-align" v-if="loading">
      <a-icon type="loading" :style="{ fontSize: '48px' }" />
    </div>
    <div class="chat-root" v-else>
      <div class="chat-container">
        <div class="chatroom-container">
          <div class="header">
            <h2>QuickLink</h2>
            <p>Expires after: {{ expireTime }}</p>
          </div>
          <div class="body" id="chat_history">
            <template v-for="(message, index) in messages">
              <div
                v-bind:key="index"
                v-if="message.type === 'text'"
                class="message-frame"
              >{{ message.data }}</div>
              <a class="img-message" v-bind:key="index" v-else :href="message.data" target="_blank">
                <img :src="message.data" :alt="message.name" />
              </a>
            </template>
          </div>
          <div class="footer">
            <a-input
              style="border-radius: 25px; width: 85%;"
              placeholder="Send message here..."
              v-model="input"
              @pressEnter="sendMessage"
            >
              <a-icon slot="suffix" type="upload" style="cursor: pointer;" @click="showModal" />
            </a-input>
            <a-button type="primary" icon="right-circle" shape="circle" @click="sendMessage" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import moment from "moment";
import { db, storage } from "../db";
import { clearInterval, setInterval } from "timers";

const sessionsRef = db.ref("sessions");
const storageRef = storage.ref();

function getBase64(img, callback) {
  const reader = new FileReader();
  reader.addEventListener("load", () => callback(reader.result));
  reader.readAsDataURL(img);
}

let timer;

export default {
  name: "Chat",
  data() {
    return {
      loading: false,
      messages: [],
      input: "",
      expireTime: "05:00",
      imageFileName: "",
      imageFile: null,
      isModalOpen: false,
      key: "",
      fileList: []
    };
  },
  computed: {
    textMessages() {
      return this.messages.filter(message => message.type === "text");
    },
    imgMessages() {
      return;
    }
  },
  watch: {
    messages: function(next, prev) {
      this.scrollToBottom();
    }
  },
  mounted() {
    this.cleanup().then(() => {
      const { id } = this.$route.params;
      sessionsRef
        .orderByChild("code")
        .equalTo(id)
        .once("value", snapshot => {
          this.loading = false;
          const val = snapshot.val();
          if (val) {
            // valid
            const data = Object.values(val)[0];
            if (!this.isExpired(data.timeStamp)) {
              this.key = Object.keys(val)[0];
              // start countdown
              sessionsRef
                .child(`${this.key}/timeStamp`)
                .on("value", snapshot => {
                  if (timer) {
                    clearInterval(timer);
                  }
                  this.expireTime = "05:00";
                  data.timeStamp = snapshot.val();
                  this.startCountDown(data);
                });

              // start messaging
              sessionsRef.child(this.key).update({
                active: true,
                timeStamp: moment()
                  .add(5, "m")
                  .valueOf()
              });

              sessionsRef
                .child(`${this.key}/messages`)
                .on("child_added", snapshot => {
                  this.messages.push(snapshot.val());
                });
            } else {
              this.pushHome();
            }
          } else {
            this.pushHome();
          }
        });
    });
  },
  methods: {
    showModal() {
      this.isModalOpen = true;
    },
    handleCancel() {
      this.isModalOpen = false;
    },
    handleOk() {
      const { id } = this.$route.params;
      const encoded = encodeURIComponent(this.imageFileName);
      const uploadTask = storageRef
        .child(`${id}/${encoded}`)
        .put(this.imageFile);

      uploadTask.on("state_changed", null, null, () => {
        uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
          sessionsRef.child(`${this.key}/messages`).push({
            type: "img",
            name: encoded,
            data: downloadURL,
            timeStamp: moment().valueOf()
          });
          this.imageFileName = "";
          this.imageFile = null;
        });
      });

      this.isModalOpen = false;
    },
    pushHome() {
      this.$router.push({ path: "/" });
    },
    cleanup() {
      return new Promise(resolve => {
        this.loading = true;
        sessionsRef.once("value", snapshot => {
          const val = snapshot.val();
          if (val) {
            const values = Object.values(val);
            values.forEach(data => {
              if (this.isExpired(data.timeStamp)) {
                sessionsRef.child(Object.keys(val)[0]).remove();
                if (data.type === "img") {
                  storageRef.child(`${data.code}/${data.name}`).delete();
                }
              }
            });
            resolve();
          } else {
            resolve();
          }
        });
      });
    },
    isExpired(timeStamp) {
      const codeTime = moment(timeStamp);
      const currentTime = moment();
      if (currentTime.isBefore(codeTime)) {
        return false;
      }
      return true;
    },
    scrollToBottom() {
      const chat_history = this.$el.querySelector("#chat_history");
      this.$nextTick(() => {
        if (chat_history) {
          const scrollHeight = chat_history.scrollHeight;
          chat_history.scrollTop = scrollHeight;
        }
      });
    },
    sendMessage() {
      const { id } = this.$route.params;
      sessionsRef.child(`${this.key}/messages`).push({
        type: "text",
        data: this.input,
        timeStamp: moment().valueOf()
      });
      this.input = "";
    },
    startCountDown(data) {
      const end = moment(data.timeStamp);
      timer = setInterval(() => {
        const now = moment();
        if (end.isBefore(now)) {
          clearInterval(timer);
          localStorage.removeItem("quick_link_id");
          this.pushHome();
        } else {
          const timeLeft = moment(end.diff(now));
          const formatted = timeLeft.format("mm:ss");
          this.expireTime = formatted;
        }
      }, 1000);
    },
    handleFileChange(info) {
      let fileList = [...info.fileList];
      fileList = fileList.map(file => {
        if (file.response) {
          // Component will show file.url as link
          file.url = file.response.url;
        }
        return file;
      });
      this.fileList = fileList;

      if (info.file.status === "done") {
        this.imageFileName = info.file.name;
        this.imageFile = info.file.originFileObj;
        this.isModalOpen = false;
        this.handleOk();
        this.fileList = [];
      }
    },
    beforeUpload(file) {
      const isJPG = file.type === "image/jpeg" || file.type === "image/png";
      if (!isJPG) {
        this.$message.error("You can only upload a PNG or JPG file!");
      }
      const isLt5M = file.size / 5242880 < 1;
      if (!isLt5M) {
        this.$message.error("Image must be smaller than 5MB!");
      }
      return isJPG && isLt5M;
    }
  }
};
</script>

<style scoped>
.center-align {
  height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
.chat-root {
  width: 100%;
  min-height: 100vh;
  background: #ddd;
  display: flex;
  justify-content: center;
  align-items: center;
}
.chat-container {
  width: 80%;
  margin: 0 auto;
  padding: 25px;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chatroom-container {
  height: 500px;
  width: 300px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-radius: 10px;
}

.chatroom-container > .header {
  height: 20%;
  background: #1890ff;
  display: flex;
  justify-content: center;
  align-items: center;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  flex-direction: column;
}

.chatroom-container > .header > h2,
p {
  margin: 0;
  color: white;
}

.chatroom-container > .body {
  height: 70%;
  background: white;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  text-align: left;
  justify-content: flex-start;
  align-items: flex-start;
}

.chatroom-container > .footer {
  height: 10%;
  background: #eee;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 10px;
  flex-direction: row;
}

.message-frame {
  border-radius: 15px;
  word-break: break-word;
  background: #778cad;
  max-width: 80%;
  padding: 10px;
  margin: 16px 0 16px 16px;
  display: inline;
  color: white;
}

.img-message {
  border-radius: 15px;
  max-width: 80%;
  margin: 16px 0 16px 16px;
}

.img-message > img {
  width: 100%;
  object-fit: cover;
}

@media screen and (max-width: 480px) {
  .chat-container {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100vh;
  }
  .chatroom-container {
    height: 100%;
    width: 100%;
    border-radius: 0px;
  }
  .chatroom-container > .header {
    border-top-left-radius: 0px;
    border-top-right-radius: 0px;
  }
  .chatroom-container > .footer {
    border-bottom-left-radius: 0px;
    border-bottom-right-radius: 0px;
  }
}
</style>