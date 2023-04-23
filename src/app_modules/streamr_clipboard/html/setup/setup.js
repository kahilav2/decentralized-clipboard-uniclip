const provider = new Web3.providers.HttpProvider('https://rpc-mainnet.maticvigil.com/');
const web3 = new Web3(provider);

export default {
  template: `
    <div>
      <div v-if="page === 'settings'">
        <div class="container flex-center">
          <div class="card">
            <div class="card-header">
              <h3 class="ml-1">Settings</h3>
            </div>
            <div class="card-body">

              <p class="mb-1"><span class="alert">IMPORTANT</span>: Never use a private key that has a substantial amount of funds! Instead, create a new private key dedicated to this application only.</p>

              <div class="input">
                <label>Private Key:</label>
              </div>
              <div class="input space-btm-1">
                <input type="text" v-model="privateKey" >
              </div>
              <div class="input">
                <label>Stream Address:</label>
              </div>
              <div class="input space-btm-1">
                <input type="text" v-model="streamUrl" >
              </div>
              <div class="input">
                <label for="address-balance">Balance:</label>
              </div>
              <div class="input space-btm-1 mb-2">
                <input class="mr-1" type="text" disabled v-model="addressBalance">
                <button class="small gray" @click.prevent="refreshBalance" >Refresh</button>
                <div v-if="addressBalance === 0">
                  You have 0 MATIC in your wallet. Send some MATIC to your public address on Polygon Network and click "Refresh".
                </div>
              </div>
              
              
              <div class="input mb-2">
                <div v-if="loading.usingStorage" class="loading-spinner">
                  <div class="spinner"></div>
                </div>
                <div v-else-if="usingStorage">
                  <p class="mb-1"><b>You are storing</b> stream history. With stored history, you will automatically retrieve latest copied items when you start Uniclip.</p>
                  <button @click="stopUsingStorage">Stop using storage</button>
                </div>
                <div v-else>
                  <p class="mb-1"><b>You're not storing</b> stream history. With stored history, you will automatically retrieve latest copied items when you start Uniclip. To start storing, you need enough funds for a transaction.</p>
                  <button @click="startUsingStorage">Start using storage</button>
                </div>
              </div>
              <div v-if="platform === 'darwin' || platform === 'win32'" class="input startup">          
                <label>Open at startup:</label>
                <input type="checkbox" v-model="openAtLogin" >
              </div>
              <div v-if="errorMessages.length > 0" class="error-messages">
                <li v-for="errorMessage, idx in errorMessages" :key="idx">
                  {{ errorMessage }}
                </li>
              </div>

            </div>
            <div class="card-footer">
              <button class="gray small" @click.prevent="goToStart">Reconfigure from scratch</button>
              <button class="btn-next" @click.prevent="finish('existing')">Save & Close</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="page == 'existing'">
        <div class="container flex-center">
          <div class="card">
            <div class="card-header">
              <h3 class="ml-1">Existing user</h3>
            </div>
            <div class="card-body">

              <p><span class="alert">IMPORTANT</span>: Never use a private key that has a substantial amount of funds! Instead, create a new private key dedicated to this application only.</p>

              <div class="input">
                <label>Private Key:</label>
              </div>
              <div class="input space-btm-1">
                <input type="text" v-model="privateKey" >
              </div>
              <div class="input">
                <label>Stream Address:</label>
              </div>
              <div class="input space-btm-1">
                <input type="text" v-model="streamUrl" >
              </div>
              <p>Or</p>
              <button class="button mb-2" @click="scanQrCode">Scan QR Code</button>
              <canvas ref="canvas" hidden></canvas>
              <video ref="video" hidden></video>
              <div v-if="errorMessages.length > 0" class="error-messages">
                <li v-for="errorMessage, idx in errorMessages" :key="idx">
                  {{ errorMessage }}
                </li>
              </div>

            </div>
            <div class="card-footer">
              <button class="back" @click.prevent="page = 'start'">Back</button>
              <button class="btn-next" @click.prevent="finish('existing')">Submit</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="page == 'new-user-1'" >
        <div class="container flex-center">
          <div class="card">
            <div class="card-header">
              <h3 class="ml-1">New user</h3>
              <h4 class="ml-2">Step 1 / 3: Wallet creation</h4>
            </div>
            <div class="card-body">
              <p>First, to be able to share your clipboard data over the internet, we need to create a Streamr stream, which transports your data encrypted (when set so!). Stream Network uses Polygon for authentication, therefore we need to create a Polygon wallet. A wallet may contain crypto assets, which are controlled with a private key. Anyone with the private key can access the funds or act on behalf of the wallet. If you have problems setting up the wallet, you can also register a stream at <a href="https://streamr.network/core" target="_blank">Streamr Core</a>. </p>
              <br>
              <p>Create a new wallet below by pressing the generate button.</p>
              <br>
              <p><span class="alert">IMPORTANT</span>: Store the private key and keep it to yourself! Anyone with your private key will be able to access your clipboard!</p>

              <button class="mt-1 mb-2" @click.prevent="generatePrivateKey">Generate a private key</button>

              <div class="input">
                <label>Private Key:</label>
              </div>
              <div class="input space-btm-1">
                <input class="mr-1" type="text" v-model="privateKey" disabled >
                <button class="small gray" @click.prevent="copyAttribute('privateKey')" >Copy</button>
              </div>
              <div class="input">
                <label>Public Address:</label>
              </div>
              <div class="input">
                <input class="mr-1" type="text" v-model="publicAddress" disabled>
                <button class="small gray" @click.prevent="copyAttribute('publicAddress')" >Copy</button>
              </div>
              <div v-if="errorMessages.length > 0" class="error-messages">
                <li v-for="errorMessage, idx in errorMessages" :key="idx">
                  {{ errorMessage }}
                </li>
              </div>
            </div>
            <div class="card-footer">
              <button class="back" @click.prevent="page = 'start'">Back</button>
              <button class="btn-next" @click.prevent="goToPage2">Next</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="page == 'new-user-2'" >
        <div class="container flex-center">
          <div class="card">
            <div class="card-header">
              <h3 class="ml-1">New user</h3>
              <h4 class="ml-2">Step 2 / 3: Add funds</h4>
            </div>
            <div class="card-body">
              <p class="mb-1">Next, we are going to transfer funds to your newly created wallet. Send a small amount of MATIC (&lt;1$ worth) to the public address below. We need it for registering the Streamr data stream.</p>
              <p class="mb-1">Verify balance and add funds:</p>
              <div class="input">
                <label>Public Address:</label>
              </div>
              <div class="input">
                <input class="mr-1" type="text" v-model="publicAddress" disabled>
                <button class="small gray" @click.prevent="copyAttribute('publicAddress')" >Copy</button>
              </div>
              <div class="input">
                <label for="address-balance">Balance:</label>
              </div>
              <div class="input space-btm-1">
                <input class="mr-1" type="text" disabled v-model="addressBalance">
                <button class="small gray" @click.prevent="refreshBalance" >Refresh</button>
              </div>
              <div v-if="addressBalance === 0">
                You have 0 MATIC in your wallet. Send some MATIC to your public address on Polygon Network and click "Refresh".
              </div>
              <div v-else>
                ✅ Your wallet has funds! You may continue.
              </div>
              <div v-if="errorMessages.length > 0" class="error-messages">
                <li v-for="errorMessage, idx in errorMessages" :key="idx">
                  {{ errorMessage }}
                </li>
              </div>
            </div>
            <div class="card-footer">
              <button class="back" @click.prevent="page = 'new-user-1'">Back</button>
              <button class="btn-next" @click.prevent="goToPage3">Next</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="page == 'new-user-3'" >
        <div class="container flex-center">
          <div class="card">
            <div class="card-header">
              <h3 class="ml-1">New user</h3>
              <h4 class="ml-2">Step 3 / 3: Create a data stream</h4>
            </div>
            <div class="card-body">
              <p class="mb-1">Final step, create the stream. You can use the default stream address.</p>
              <div class="input">
                <label for="stream-url-input">Stream Address:</label>
              </div>
              <div class="input space-btm-1">
                <input :disabled="!streamUrlEditMode" class="mr-1" type="text" v-model="streamUrlEdit" >
                <button class="small gray" @click.prevent="onEditModePressed()">{{ streamUrlEditMode ? 'Save' : 'Edit'  }}</button>
              </div>
              <div v-if="streamGenerated">
              ✅ Stream has been generated!
              </div>
              <div v-else>
                <div v-if="loading.createStream" class="loading-spinner">
                  <div class="spinner"></div>
                </div>
                <div v-else>
                  <button class="mt-1 mb-1" @click.prevent="startCreatingStream()" >Create a stream</button>
                </div>
              </div>
              <div v-if="errorMessages.length > 0" class="error-messages">
                <li v-for="errorMessage, idx in errorMessages" :key="idx">
                  {{ errorMessage }}
                </li>
              </div>
            </div>
            <div class="card-footer">
              <button class="back" @click.prevent="page = 'new-user-2'">Back</button>
              <button class="btn-next" @click.prevent="goToPage4">Next</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="page == 'new-user-4'" >
        <div class="container flex-center">
          <div class="card">
            <div class="card-header">
              <h3 class="ml-1">New user</h3>
              <h4 class="ml-2">Ready</h4>
            </div>
            <div class="card-body">
              <h2 class="mb-1">Your device is all set!</h2>
              <p class="mb-1">Congratulations! Your first device is now ready to use your decentralized clipboard! </p>
              <h3 class="mb-1">Connect with other devices</h3>
              <p> Next, you should add another device to your decentralized clipboard. After you click 'Finish', the instructions will be opened for you. </p>
            </div>
            <div class="card-footer">
              <button class="btn-next" @click.prevent="finish('new')">Finish</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="page === 'start'">
        <h1>Create Your Decentralized Clipboard</h1>
        <p class="ml-2">
          Are you a new user or an existing user?
        </p>
        <div class="container flex-space-between">
          <div class="card half">
            <div class="card-header">
              <h3 class="ml-1">New user</h3>
            </div>
            <div class="card-body">
              <p>You'll create:</p>
              <ul>
                <li>New Polygon private key</li>
                <li>Streamr stream</li>
              </ul>
              <p>You'll need:</p>
              <ul>
                <li>MATIC for enough for a smart contract transaction</li>
              </ul>
            </div>
            <div class="card-footer">
              <button class="btn-next push-right" @click.prevent="page = 'new-user-1'">Next</button>
            </div>
          </div>
          <div class="card half">
            <div class="card-header">
              <h3 class="ml-1">Existing user</h3>
            </div>
            <div class="card-body">
              <p>You already have:</p>
              <ul>
                <li>Private key</li>
                <li>Streamr stream</li>
              </ul>
            </div>
            <div class="card-footer">
              <button class="btn-next push-right" @click.prevent="page = 'existing'">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    `,
  data() {
    return {
      openAtLogin: false,
      platform: '',
      loading: {},
      privateKey: '',
      publicAddress: '',
      addressBalance: 0,
      streamUrl: '',
      streamUrlEdit: '',
      page: 'start',
      streamUrlEditMode: false,
      errorMessages: [],
      streamGenerated: false,
      usingStorage: false,
      streamrCli: null
    };
  },
  watch: {
    page(newValue, oldValue) {
      this.errorMessages = [];
    },
    streamUrl(newValue, oldValue) {
      this.streamUrlEdit = newValue;
    },
    openAtLogin(newValue, oldValue) {
      window.uniclip.setOpenAtLogin(newValue);
    }
  },
  async created() {
    const { appModuleConfig, platform, openAtLogin } = await window.uniclip.getSettings();
    console.log('appModuleConfig, platform, openAtLogin', appModuleConfig, platform, openAtLogin);
    if (appModuleConfig !== undefined) {
      this.platform = platform;
      this.openAtLogin = openAtLogin;
      this.privateKey = appModuleConfig.privateKey;
      this.streamUrl = appModuleConfig.streamUrl;
      this.page = 'settings';
      this.checkIfUsingStorage();
      this.refreshBalance();
    }
  },
  methods: {
    async tick() {
      const { video } = this.$refs;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }
      const { canvas } = this.$refs;
      const canvasCtx = this.$refs.canvas.getContext('2d');
      canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });
      if (!code) {
        requestAnimationFrame(this.tick);
        return;
      }
      // Scan complete, stop video stream
      if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(function (track) {
          track.stop();
        });
      }
      const config = JSON.parse(code.data);
      canvas.hidden = true;
      this.privateKey = config.k;
      const addr = await this.getStreamrCli().getAddress();
      this.streamUrl = addr + '/' + config.id;
      this.errorMessages = [];
    },
    async scanQrCode() {
      const { video, canvas } = this.$refs;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      video.setAttribute('playsinline', true); // required to tell iOS safari we don't want fullscreen
      video.play();
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.hidden = false;
        this.tick();
      });
    },
    async stopUsingStorage() {
      this.loading.usingStorage = true;
      try {
        await this.getStreamrCli().removeStreamFromStorageNode(
          this.streamUrl,
          StreamrClient.STREAMR_STORAGE_NODE_GERMANY
        );

        this.usingStorage = false;
      } catch (err) {
        this.errorMessages = ["Couldn't deregister to a storage node, make sure you have enough funds."];
      }
      this.loading.usingStorage = false;
    },
    async startUsingStorage() {
      this.loading.usingStorage = true;
      try {
        await this.getStreamrCli().addStreamToStorageNode(this.streamUrl, StreamrClient.STREAMR_STORAGE_NODE_GERMANY);
        this.usingStorage = true;
      } catch (err) {
        this.errorMessages = ["Couldn't register to a storage node, make sure you have enough funds."];
      }
      this.loading.usingStorage = false;
    },
    async checkIfUsingStorage() {
      this.loading.usingStorage = true;
      try {
        this.usingStorage = await this.getStreamrCli().isStoredStream(
          this.streamUrl,
          StreamrClient.STREAMR_STORAGE_NODE_GERMANY
        );
      } catch (err) {
        this.errorMessages = ["Couldn't verify storage use status"];
      }
      this.loading.usingStorage = false;
    },
    async copyAttribute(name) {
      const attr = this[name];
      try {
        await navigator.clipboard.writeText(attr);
      } catch (err) {
        this.errorMessage = err.toString();
      }
    },
    async refreshBalance() {
      try {
        const balance = await this.getBalanceFromPrivateKey(this.privateKey);
        if (balance !== 0) {
          this.errorMessages = [];
        }
        this.addressBalance = balance;
      } catch (err) {
        this.errorMessages = [err.toString()];
      }
    },
    async goToStart() {
      this.privateKey = '';
      this.publicAddress = '';
      this.streamUrl = '';
      this.addressBalance = 0;
      this.page = 'start';
    },
    async goToPage2() {
      const isValid = this.privateKey !== '' && this.publicAddress !== '';
      if (isValid) {
        this.page = 'new-user-2';
        this.errorMessages = [];
        try {
          const balance = await this.getBalanceFromPrivateKey(this.privateKey);
          this.addressBalance = balance;
        } catch (err) {}
      } else {
        this.errorMessages = ['Please generate a private key before proceeding'];
      }
    },
    async checkIfStreamExists() {
      try {
        const streamExists = await this.getStreamrCli().isStreamPublisher(this.streamUrl, this.publicAddress);
        this.streamGenerated = streamExists;
        if (!streamExists) {
          this.errorMessages = [`Stream ${this.streamUrl} doesn't exist. Generate it first.`];
        }
        if (streamExists) {
          this.errorMessages = [];
        }
      } catch (err) {
        this.errorMessages = [err.toString()];
      }
    },
    goToPage3() {
      const isValid = this.addressBalance !== 0;
      if (isValid) {
        this.page = 'new-user-3';
        this.errorMessages = [];
      } else {
        this.errorMessages = ['You need to have funds in your wallet to continue.'];
      }
    },
    async goToPage4() {
      if (!this.streamGenerated) {
        await this.checkIfStreamExists();
      }
      const isValid = this.streamGenerated;
      if (isValid) {
        this.page = 'new-user-4';
        this.errorMessages = [];
      } else {
        this.errorMessages = ['You need to create the stream first to continue.'];
      }
    },
    startCreatingStream() {
      this.createStream();
    },
    async createStream() {
      this.loading.createStream = true;
      try {
        const id = '/' + this.streamUrl.split('/', 2)[1];
        const res = await this.getStreamrCli().getOrCreateStream({
          id
        });
        this.streamUrl = res.id;
        this.streamGenerated = true;
      } catch (err) {
        this.errorMessages = [
          'Something went wrong, make sure you have enough balance for a smart contract transaction',
          err.toString()
        ];
      }
      this.loading.createStream = false;
    },
    getStreamrCli() {
      if (!this.streamrCli) {
        this.streamrCli = new StreamrClient({
          auth: {
            privateKey: this.privateKey
          }
        });
      }
      return this.streamrCli;
    },
    async generatePrivateKey() {
      const { address: publicAddress, privateKey } = StreamrClient.generateEthereumAccount();
      this.privateKey = privateKey;
      this.publicAddress = publicAddress;
      this.streamUrl = this.publicAddress + '/' + 'appname';
    },
    onEditModePressed() {
      this.streamUrlEditMode = !this.streamUrlEditMode;
      if (!this.streamUrlEditMode) {
        this.streamUrl = this.streamUrlEdit;
        this.checkIfStreamExists();
      }
    },
    onSubmit() {},
    finish(mode) {
      const isValid = this.privateKey !== '' && this.streamUrl !== '';

      if (isValid) {
        window.uniclip.finish(
          JSON.stringify({
            privateKey: this.privateKey,
            streamUrl: this.streamUrl
          })
        );
      } else {
        this.errorMessages = [
          mode === 'existing' ? 'Provide both private key and stream address' : 'Something went wrong'
        ];
      }
    },
    async getBalanceFromPrivateKey(privateKey) {
      const { address } = web3.eth.accounts.privateKeyToAccount(privateKey);

      // Get the balance of the address in wei
      return new Promise((resolve, reject) => {
        web3.eth.getBalance(address, (error, result) => {
          if (!error) {
            resolve(parseFloat(web3.utils.fromWei(result, 'ether')));
          } else {
            reject(error);
          }
        });
      });
    }
  },
  mounted() {},
  beforeUnmount() {
    if (this.streamrCli) {
      this.streamrCli.destroy();
    }
  }
};
