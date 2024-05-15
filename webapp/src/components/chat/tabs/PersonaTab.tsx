// Copyright (c) Microsoft. All rights reserved.

import * as React from 'react';
import { useChat } from '../../../libs/hooks/useChat';
import { useAppDispatch, useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { editConversationSystemDescription } from '../../../redux/features/conversations/conversationsSlice';
import { MemoryBiasSlider } from '../persona/MemoryBiasSlider';
import { PromptEditor } from '../persona/PromptEditor';
import { TabView } from './TabView';

export const PersonaTab: React.FC = () => {
    const chat = useChat();
    const dispatch = useAppDispatch();

    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const chatState = conversations[selectedId];

    const [shortTermMemory, setShortTermMemory] = React.useState<string>('');
    const [longTermMemory, setLongTermMemory] = React.useState<string>('');

    React.useEffect(() => {
        if (!conversations[selectedId].disabled) {
            void Promise.all([
                chat.getSemanticMemories(selectedId, 'WorkingMemory').then((memories) => {
                    setShortTermMemory(memories.join('\n'));
                }),
                chat.getSemanticMemories(selectedId, 'LongTermMemory').then((memories) => {
                    setLongTermMemory(memories.join('\n'));
                }),
            ]);
        }
        // Vi vil ikke ha chat som en av avhengighetene siden det vil forårsake en uendelig løkke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    return (
        <TabView title="Persona" learnMoreDescription="personas" learnMoreLink=" https://aka.ms/sk-intro-to-personas ">
            <PromptEditor
                title="Meta Prompt"
                chatId={selectedId}
                prompt={chatState.systemDescription}
                isEditable={true}
                info="Prompten som definerer chattebottens persona."
                modificationHandler={async (newSystemDescription: string) => {
                    await chat
                        .editChat(selectedId, chatState.title, newSystemDescription, chatState.memoryBalance)
                        .finally(() => {
                            dispatch(
                                editConversationSystemDescription({
                                    id: selectedId,
                                    newSystemDescription: newSystemDescription,
                                }),
                            );
                        });
                }}
            />
            <PromptEditor
                title="Kortsiktig Minne"
                chatId={selectedId}
                prompt={`<label>: <details>\n${shortTermMemory}`}
                isEditable={false}
                info="Trekk ut informasjon for en kort periode, som noen sekunder eller minutter. Det bør være nyttig for å utføre komplekse kognitive oppgaver som krever oppmerksomhet, konsentrasjon eller mental beregning."
            />
            <PromptEditor
                title="Langsiktig Minne"
                chatId={selectedId}
                prompt={`<label>: <details>\n${longTermMemory}`}
                isEditable={false}
                info="Trekk ut informasjon som er kodet og konsolidert fra andre minnetyper, som arbeidsminne eller sensorisk minne. Det bør være nyttig for å opprettholde og gjenkalle ens personlige identitet, historie og kunnskap over tid."
            />
            <MemoryBiasSlider />
        </TabView>
    );
};
