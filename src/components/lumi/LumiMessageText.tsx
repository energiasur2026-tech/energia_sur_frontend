import {Fragment} from 'react';
import styles from './lumi.module.css';

/** Currency emphasis only. All other content remains escaped React text. */
export function LumiMessageText({text}:{text:string}) {
  const chunks=text.split(/(\$\s*-?\d+(?:\.\d{3})*(?:,\d{1,2})?)/g);
  return <>{chunks.map((chunk,index)=>index%2
    ? <strong className={styles.amount} key={index}>{chunk}</strong>
    : <Fragment key={index}>{chunk}</Fragment>)}</>;
}
