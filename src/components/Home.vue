<template>
  <div>
    <div class="center-align" v-if="loading">
      <a-icon type="loading" :style="{ fontSize: '48px' }" />
    </div>
    <div class="center-align" v-else>
      <h1>QuickLink</h1>
      <qrcode :value="codeURL" :options="{ width: 300 }"></qrcode>
      <p>Scan this QR code from your phone and start messaging!</p>
    </div>
  </div>
</template>

<script>
import VueQrcode from "@chenfengyuan/vue-qrcode";
import uniqid from "uniqid";
import { db, storage } from "../db";
import moment from "moment";
import { Promise } from "q";
import { setInterval } from "timers";

const sessionsRef = db.ref("sessions");
const storageRef = storage.ref();
export default {
  name: "Home",
  components: {
    qrcode: VueQrcode
  },
  data() {
    return {
      code: uniqid(),
      loading: false
    };
  },
  computed: {
    codeURL() {
      return window.location.origin + "/chat/" + this.code;
    }
  },
  mounted() {
    this.cleanup().then(() => {
      const quick_link_id = localStorage.getItem("quick_link_id");
      if (quick_link_id) {
        this.loading = true;
        // check if valid and not expired
        sessionsRef
          .orderByChild("code")
          .equalTo(quick_link_id)
          .once("value", snapshot => {
            this.loading = false;
            const val = snapshot.val();
            if (val) {
              // valid
              const data = Object.values(val)[0];
              const key = Object.keys(val)[0];
              if (!this.isExpired(data.timeStamp)) {
                // extend timestamp
                sessionsRef.child(key).update({
                  timeStamp: moment()
                    .add(5, "m")
                    .valueOf()
                });
                this.autoExtend(key);
                this.code = data.code;
                this.listen();
              } else {
                this.useNewCode();
              }
            } else {
              this.useNewCode();
            }
          });
      } else {
        this.loading = false;
        this.useNewCode();
      }
    });
  },
  methods: {
    useNewCode() {
      sessionsRef
        .push({
          code: this.code,
          timeStamp: moment()
            .add(5, "m")
            .valueOf(),
          active: false
        })
        .then(snapshot => {
          const { key } = snapshot;
          this.autoExtend(key);
        });
      localStorage.setItem("quick_link_id", this.code);
      this.listen();
    },
    autoExtend(key) {
      setInterval(() => {
        if (window.location.pathname === "/") {
          sessionsRef.child(key).update({
            timeStamp: moment()
              .add(5, "m")
              .valueOf()
          });
        }
      }, 1000 * 60 * 5);
    },
    listen() {
      sessionsRef
        .orderByChild("code")
        .equalTo(this.code)
        .on("value", snapshot => {
          const val = snapshot.val();
          const data = Object.values(val)[0];
          if (data.active) {
            this.$router.push({ path: `/chat/${this.code}` });
          }
        });
    },
    cleanup() {
      return new Promise(resolve => {
        this.loading = true;
        sessionsRef.once("value", snapshot => {
          const val = snapshot.val();
          if (val) {
            const values = Object.values(val);
            const keys = Object.keys(val);
            values.forEach((data, i) => {
              if (this.isExpired(data.timeStamp)) {
                if (data.messages) {
                  Object.values(data.messages).forEach(message => {
                    if (message.type === "img") {
                      storageRef.child(`${data.code}/${message.name}`).delete();
                    }
                  });
                }
                sessionsRef.child(keys[i]).remove();
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
      if (currentTime.isBefore(codeTime) || codeTime.diff(currentTime, 'minutes') > 5) {
        return false;
      }
      return true;
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}

.center-align {
  height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
</style>
