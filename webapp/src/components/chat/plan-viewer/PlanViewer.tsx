import { Button, Text, makeStyles, mergeClasses, shorthands, tokens } from '@fluentui/react-components';
import { CheckmarkCircle24Regular, DismissCircle24Regular, Info24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useChat } from '../../../libs/hooks/useChat';
import { IChatMessage } from '../../../libs/models/ChatMessage';
import { PlanState, ProposedPlan } from '../../../libs/models/Plan';
import { getPlanGoal } from '../../../libs/utils/PlanUtils';
import { useAppDispatch, useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { updateMessageProperty } from '../../../redux/features/conversations/conversationsSlice';
import { PlanBody } from './PlanBody';

export const usePlanViewClasses = makeStyles({
    container: {
        ...shorthands.gap(tokens.spacingVerticalM),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'baseline',
    },
    buttons: {
        display: 'flex',
        flexDirection: 'row',
        marginTop: tokens.spacingVerticalM,
        marginBottom: tokens.spacingVerticalM,
        ...shorthands.gap(tokens.spacingHorizontalL),
    },
    status: {
        ...shorthands.gap(tokens.spacingHorizontalMNudge),
    },
    text: {
        alignSelf: 'center',
    },
});

interface PlanViewerProps {
    message: IChatMessage;
    messageIndex: number;
}

export const PlanViewer: React.FC<PlanViewerProps> = ({ message, messageIndex }) => {
    const classes = usePlanViewClasses();
    const dispatch = useAppDispatch();
    const { selectedId } = useAppSelector((state: RootState) => state.conversations);
    const chat = useChat();

    // Track original plan from user message
    const parsedContent = JSON.parse(message.content) as ProposedPlan;
    const originalPlan = parsedContent.proposedPlan;
    const planState =
        parsedContent.state === PlanState.Derived ? PlanState.Derived : (message.planState ?? parsedContent.state);
    const [plan, setPlan] = useState(originalPlan);

    const onPlanAction = async (planState: PlanState.Approved | PlanState.Rejected) => {
        const updatedPlan = JSON.stringify({
            ...parsedContent,
            proposedPlan: plan,
            state: planState,
            generatedPlanMessageId: message.id,
        });

        // Update bot message with new plan state
        dispatch(
            updateMessageProperty({
                messageIdOrIndex: messageIndex,
                chatId: selectedId,
                property: 'planState',
                value: planState,
                updatedContent: updatedPlan,
                frontLoad: true,
            }),
        );

        await chat.processPlan(selectedId, planState, updatedPlan);
    };

    return (
        <div className={classes.container}>
            <Text>Basert på førespurnaden, vil Mimir køyre følgjande steg:</Text>
            <PlanBody
                plan={plan}
                setPlan={setPlan}
                planState={planState}
                description={getPlanGoal(
                    parsedContent.userIntent ??
                        parsedContent.originalUserInput ??
                        parsedContent.proposedPlan.description,
                )}
            />
            {planState === PlanState.PlanApprovalRequired && (
                <>
                    Ønsker du å gå vidare med planen?
                    <div className={classes.buttons}>
                        <Button
                            data-testid="cancelPlanButton"
                            appearance="secondary"
                            onClick={() => {
                                void onPlanAction(PlanState.Rejected);
                            }}
                        >
                            Nei, avbryt planen
                        </Button>
                        <Button
                            data-testid="proceedWithPlanButton"
                            type="submit"
                            appearance="primary"
                            onClick={() => {
                                void onPlanAction(PlanState.Approved);
                            }}
                        >
                            Ja, gå vidare
                        </Button>
                    </div>
                </>
            )}
            {(planState === PlanState.Approved || planState === PlanState.Derived) && (
                <div className={mergeClasses(classes.buttons, classes.status)}>
                    <CheckmarkCircle24Regular />
                    <Text className={classes.text}> Plan Utført</Text>
                </div>
            )}
            {planState === PlanState.Rejected && (
                <div className={mergeClasses(classes.buttons, classes.status)}>
                    <DismissCircle24Regular />
                    <Text className={classes.text}> Plan Avbryt</Text>
                </div>
            )}
            {(planState === PlanState.NoOp || planState === PlanState.Disabled) && (
                <div className={mergeClasses(classes.buttons, classes.status)}>
                    <Info24Regular />
                    <Text className={classes.text}>
                        {planState === PlanState.NoOp
                            ? 'Applikasjonstilstanden din har endra seg sidan denne planen vart generert, noko som gjer den upåliteleg for planleggjaren. Vennligst be om ein fersk plan for å unngå potensielle konflikter.'
                            : 'Berre personen som initierte denne planen kan utføre handlingar på den.'}
                    </Text>
                </div>
            )}
        </div>
    );
};
