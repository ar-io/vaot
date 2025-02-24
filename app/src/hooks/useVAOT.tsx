import { AOProcess, ARWEAVE_TX_REGEX } from '@ar.io/sdk';
import { useActiveStrategy } from '@project-kardeshev/ao-wallet-kit';
import { VAOT, VAOTRead, VAOTWrite } from '@/services/vaot';
import { useEffect, useState } from 'react';
import { connect } from '@permaweb/aoconnect';
import { useGlobalState } from '@/store';

export function useVAOT(id?: string): VAOTRead | VAOTWrite | null {
  const cuUrl = useGlobalState((state) => state.aoCuUrl);
  const gatewayUrl = useGlobalState((state) => state.gatewayUrl);
  const strategy = useActiveStrategy();

  const [vaot, setVaot] = useState<VAOTRead | VAOTWrite | null>(null);

  useEffect(() => {
    async function update() {
      if (id && ARWEAVE_TX_REGEX.test(id) && strategy) {
        const newVaot = VAOT.init({
          process: new AOProcess({
            processId: id,
            ao: connect({
              CU_URL: cuUrl,
            }),
          }),
          signer: await strategy?.createDataItemSigner(),
        });
        setVaot(newVaot);
      } else {
        setVaot(null);
      }
    }
    update();
  }, [id, strategy, cuUrl, gatewayUrl]);

  return vaot;
}
