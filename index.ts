// Must load before anything that uses crypto.getRandomValues (ethers wallets, ids).
import 'react-native-get-random-values';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
