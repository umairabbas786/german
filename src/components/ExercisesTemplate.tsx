import React from 'react';
import {
  fillBlanksForTranslate,
  firstCanonicalSolution,
  indicesFromAnswer,
  textAnswerMatches,
} from '../features/exercises/answerUtils';
import type {
  ExerciseType,
  FillInBlankExercise,
  MultipleChoiceExercise,
  SentenceBuildingExercise,
  TextSolutionEntry,
  TrueFalseExercise,
  WordOrderExercise,
} from '../features/exercises/types';

export type { ExerciseType } from '../features/exercises/types';

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

const CORRECT_INPUT =
  'border-emerald-500/70 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]';
const INCORRECT_INPUT =
  'border-red-500/70 shadow-[0_0_0_2px_rgba(239,68,68,0.12)]';

const CORRECT_ROW =
  'max-lg:border-emerald-500/70 max-lg:shadow-[0_0_0_2px_rgba(16,185,129,0.15)]';
const INCORRECT_ROW =
  'max-lg:border-red-500/70 max-lg:shadow-[0_0_0_2px_rgba(239,68,68,0.12)]';

const EXERCISES_ROOT =
  'flex h-full w-full flex-col pb-6 max-lg:h-auto max-lg:bg-transparent max-lg:p-[10px_20px_20px]';

const INSTRUCTION_BOX =
  'mb-5 rounded-xl border border-black/5 bg-black/[0.03] p-3 px-4 max-lg:m-0 max-lg:mb-5 max-lg:rounded-2xl max-lg:border-black/5 max-lg:bg-black/[0.03] max-lg:p-4 max-sm:mb-4 max-sm:p-[10px_12px]';

const INSTRUCTION_LABEL =
  'mb-2 block text-[10px] font-extrabold uppercase text-[#666] max-sm:mb-1.5 max-sm:text-[9px]';

const INSTRUCTION_TEXT =
  'm-0 text-sm leading-normal text-[#333] max-sm:text-[13px]';

/** Shared exercise instruction banner for reading/listening modules. */
export const exerciseTitleClassName = cx(
  'mb-4 rounded-xl border border-[rgba(120,119,198,0.2)] bg-[rgba(120,119,198,0.1)] px-4 py-3 text-center text-sm leading-snug font-semibold text-[rgba(120,119,198,0.9)]',
  'max-lg:mx-5 max-lg:mb-4 max-lg:w-[calc(100%-40px)] max-sm:px-3 max-sm:py-2.5 max-sm:text-[13px]',
);

const EXERCISE_TABLE =
  'mb-[30px] w-full border-collapse max-lg:mb-0 max-lg:block max-lg:w-full [&_tbody]:max-lg:block [&_tbody]:max-lg:w-full [&_tbody::after]:block [&_tbody::after]:h-6 [&_tbody::after]:content-[""]';

const EXERCISE_ROW =
  'border-b border-black/[0.08] max-lg:mb-5 max-lg:block max-lg:w-full max-lg:rounded-3xl max-lg:border max-lg:border-black/5 max-lg:bg-white/80 max-lg:p-3 max-lg:shadow-[0_4px_12px_rgba(0,0,0,0.03)]';

const QUESTION_CELL =
  'border border-black/10 p-3 text-left align-middle text-sm max-lg:m-0 max-lg:mb-3.5 max-lg:block max-lg:w-full max-lg:border-0 max-lg:p-0 max-lg:text-[17px] max-lg:leading-8 max-lg:text-black max-sm:p-2 max-sm:text-[13px]';

const ANSWER_CELL =
  'w-[200px] border border-black/10 p-3 text-center max-lg:block max-lg:w-full max-lg:border-0 max-lg:p-0 max-lg:text-left max-sm:w-[150px] max-sm:p-2';

const EXERCISE_INPUT =
  'w-full rounded-md border border-black/20 bg-white/90 px-3 py-2 text-sm text-[#333] transition-[border-color] duration-300 focus:border-[rgba(120,119,198,0.5)] focus:shadow-[0_0_0_2px_rgba(120,119,198,0.1)] focus:outline-none max-lg:min-h-[52px] max-lg:rounded-2xl max-lg:border-black/10 max-lg:bg-white max-lg:px-4 max-lg:text-base max-lg:shadow-none max-sm:px-2 max-sm:py-1.5 max-sm:text-[13px]';

const TranslateIcon: React.FC<{
  text: string;
  onTranslate?: (text: string, opts?: { wholeSentence?: boolean }) => void;
  wholeSentence?: boolean;
}> = ({ text, onTranslate, wholeSentence }) => {
  if (!onTranslate) return null;
  return (
    <button
      className="flex h-full w-full cursor-pointer items-center justify-center border-none bg-transparent p-1.5 opacity-[0.35] transition-opacity duration-200 hover:opacity-80"
      onClick={(e) => {
        e.stopPropagation();
        onTranslate(text, wholeSentence ? { wholeSentence: true } : undefined);
      }}
      title="Translate"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="black">
        <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    </button>
  );
};

interface ExercisesTemplateProps {
  type?: ExerciseType;
  title: string;
  submitted?: boolean;
  onTranslate?: (text: string, opts?: { wholeSentence?: boolean }) => void;
  /** When true: fill-in-blank translates raw sentence (blanks kept, hints stripped); true/false translates whole statement. Used by reading/listening. */
  rawTranslate?: boolean;
  [key: string]: unknown;
}

const WordOrderRow: React.FC<{
  words: string[];
  index: number;
  answer: string;
  solution: TextSolutionEntry;
  submitted?: boolean;
  onAnswerChange: (index: number, value: string) => void;
  onTranslate?: (text: string, opts?: { wholeSentence?: boolean }) => void;
}> = ({ words, index, answer, solution, submitted, onAnswerChange, onTranslate }) => {
  const placedIndices = indicesFromAnswer(words, answer);
  const isCorrect = submitted && textAnswerMatches(answer, solution);
  const isIncorrect = submitted && !isCorrect;

  const syncAnswer = (indices: number[]) => {
    onAnswerChange(index, indices.map((i) => words[i]).join(' '));
  };

  const handleBankTap = (wordIndex: number) => {
    if (submitted) return;
    syncAnswer([...placedIndices, wordIndex]);
  };

  const handleSolutionTap = (position: number) => {
    if (submitted) return;
    syncAnswer(placedIndices.filter((_, i) => i !== position));
  };

  const availableIndices = words
    .map((_, i) => i)
    .filter((i) => !placedIndices.includes(i));

  return (
    <div
      className={cx(
        'flex flex-col gap-2 rounded-xl border border-black/[0.08] bg-white/[0.72] p-3',
        'max-lg:mb-5 max-lg:rounded-3xl max-lg:border-black/5 max-lg:bg-white/80 max-lg:p-3 max-lg:shadow-[0_4px_12px_rgba(0,0,0,0.03)]',
        submitted && isCorrect && 'border-emerald-500/55 shadow-[0_0_0_1px_rgba(16,185,129,0.12)] max-lg:border-emerald-500/70 max-lg:shadow-[0_0_0_2px_rgba(16,185,129,0.15)]',
        submitted && isIncorrect && 'border-red-500/55 shadow-[0_0_0_1px_rgba(239,68,68,0.1)] max-lg:border-red-500/70 max-lg:shadow-[0_0_0_2px_rgba(239,68,68,0.12)]',
      )}
    >
      <div className="box-border flex h-[50px] min-h-[50px] max-h-[50px] items-center gap-2 rounded-[10px] border border-black/[0.06] bg-black/[0.035] py-0 pr-2 pl-1.5 max-lg:h-auto max-lg:max-h-none max-lg:min-h-[50px]">
        <span className="min-w-4 shrink-0 text-[13px] font-semibold leading-none text-[#555]">{index + 1}.</span>
        <div className="flex h-full min-w-0 flex-1 flex-wrap content-center items-center gap-1.5 overflow-hidden max-lg:h-auto max-lg:overflow-visible">
          {availableIndices.length === 0 ? (
            <span className="text-xs italic leading-snug text-black/38">No words left</span>
          ) : (
            availableIndices.map((wordIndex) => (
              <button
                key={wordIndex}
                type="button"
                className="cursor-pointer rounded-lg border border-black/10 bg-white px-[13px] py-[7px] text-[13px] font-medium leading-tight text-[#2d2d2d] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[border-color,background,transform] duration-150 hover:border-[rgba(120,119,198,0.45)] hover:bg-[rgba(120,119,198,0.06)] active:scale-[0.97] disabled:cursor-default max-sm:px-3.5 max-sm:py-2 max-sm:text-sm"
                onClick={() => handleBankTap(wordIndex)}
                disabled={submitted}
              >
                {words[wordIndex]}
              </button>
            ))
          )}
        </div>
        {onTranslate && (
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white [&_button]:opacity-50 [&_button:hover]:opacity-85">
            <TranslateIcon
              text={firstCanonicalSolution(solution)}
              onTranslate={onTranslate}
              wholeSentence
            />
          </div>
        )}
      </div>
      <div
        className={cx(
          'box-border flex h-[76px] min-h-[76px] max-h-[76px] flex-wrap content-center items-center gap-1.5 overflow-x-hidden overflow-y-auto rounded-[10px] border-[1.5px] border-dashed border-black/[0.14] bg-white p-[10px_12px] transition-[border-color,background] duration-200',
          'max-lg:h-auto max-lg:max-h-none max-lg:min-h-[76px]',
          isCorrect && 'border-solid border-emerald-500/50 bg-emerald-500/[0.06]',
          isIncorrect && 'border-solid border-red-500/50 bg-red-500/[0.04]',
        )}
      >
        {placedIndices.length === 0 ? (
          <span className="text-xs italic leading-snug text-black/38">Tap words above to build your sentence</span>
        ) : (
          placedIndices.map((wordIndex, pos) => (
            <button
              key={`${wordIndex}-${pos}`}
              type="button"
              className="cursor-pointer rounded-lg border border-[rgba(120,119,198,0.32)] bg-[rgba(120,119,198,0.1)] px-[13px] py-[7px] text-[13px] font-medium leading-tight text-[#454380] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[border-color,background,transform] duration-150 hover:border-[rgba(120,119,198,0.45)] hover:bg-[rgba(120,119,198,0.06)] active:scale-[0.97] disabled:cursor-default max-sm:px-3.5 max-sm:py-2 max-sm:text-sm"
              onClick={() => handleSolutionTap(pos)}
              disabled={submitted}
            >
              {words[wordIndex]}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export const ExercisesTemplate: React.FC<ExercisesTemplateProps> = (props) => {
  const { title } = props;
  const renderQuestionWithTranslate = (
    content: React.ReactNode,
    translateText: string,
    wholeSentence?: boolean
  ) => (
    <div className="flex w-full items-stretch gap-2">
      <div className="min-w-0 flex-1 text-left">{content}</div>
      {props.onTranslate && (
        <div className="flex min-w-[34px] shrink-0 items-center justify-center rounded-md border border-black/[0.12] bg-[rgba(248,249,250,0.8)]">
          <TranslateIcon
            text={translateText}
            onTranslate={props.onTranslate}
            wholeSentence={wholeSentence}
          />
        </div>
      )}
    </div>
  );

  const renderInstructionBox = () => {
    if (!title) return null;
    return (
      <div className={INSTRUCTION_BOX}>
        <label className={INSTRUCTION_LABEL}>Instruction</label>
        <p className={INSTRUCTION_TEXT}>{title}</p>
      </div>
    );
  };

  const renderFillInBlank = (exercise: FillInBlankExercise) => (
    <div>
      {renderInstructionBox()}
      <table className={EXERCISE_TABLE}>
      <tbody>
        {exercise.exercises.map((ex, index) => {
          const sol = exercise.solutions[index];
          const answerStr = Array.isArray(sol) ? sol[0] : sol;
          const translateSource = props.rawTranslate
            ? ex.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
            : fillBlanksForTranslate(ex, answerStr ?? '');
          const inputCorrect = props.submitted && textAnswerMatches(exercise.answers[index], exercise.solutions[index]);
          const inputIncorrect = props.submitted && !inputCorrect;
          return (
          <tr
            key={index}
            className={cx(
              EXERCISE_ROW,
              inputCorrect && CORRECT_ROW,
              inputIncorrect && INCORRECT_ROW,
            )}
          >
            <td className={QUESTION_CELL}>{renderQuestionWithTranslate(ex, translateSource, true)}</td>
            <td className={ANSWER_CELL}>
              <input
                type="text"
                className={cx(
                  EXERCISE_INPUT,
                  inputCorrect && CORRECT_INPUT,
                  inputIncorrect && INCORRECT_INPUT,
                )}
                value={exercise.answers[index]}
                onChange={(e) => exercise.onAnswerChange(index, e.target.value)}
                placeholder="Your answer..."
              />
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );

  const renderTrueFalse = (exercise: TrueFalseExercise) => (
    <div className="flex flex-col gap-5 after:block after:h-6 after:content-['']">
      {renderInstructionBox()}
      {exercise.text && exercise.text.trim() && (
        <div className="rounded-lg border border-black/10 bg-[rgba(248,249,250,0.8)] p-4 max-lg:m-0 max-lg:mb-5 max-lg:rounded-2xl max-lg:border-black/5 max-lg:bg-black/[0.03] max-lg:p-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-[#333]">Text:</h4>
          <div className="m-0 text-sm leading-normal text-[#555]">
            {renderQuestionWithTranslate(exercise.text, exercise.text)}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {exercise.statements.map((statement, index) => {
          const rowCorrect = props.submitted && exercise.answers[index] === exercise.solutions[index];
          const rowIncorrect = props.submitted && !rowCorrect;
          return (
          <div
            key={index}
            className={cx(
              'flex items-center justify-between rounded-md border border-black/10 bg-white/50 p-3',
              'max-lg:mb-5 max-lg:flex-col max-lg:items-stretch max-lg:gap-3.5 max-lg:rounded-3xl max-lg:border-black/5 max-lg:bg-white/80 max-lg:p-3 max-lg:shadow-[0_4px_12px_rgba(0,0,0,0.03)]',
              rowCorrect && 'border-emerald-500/70 max-lg:border-emerald-500/70 max-lg:shadow-[0_0_0_2px_rgba(16,185,129,0.15)]',
              rowIncorrect && 'border-red-500/70 max-lg:border-red-500/70 max-lg:shadow-[0_0_0_2px_rgba(239,68,68,0.12)]',
            )}
          >
            <div className="flex-1 pr-3 text-left text-sm text-[#333] max-lg:w-full max-lg:pr-0 max-sm:pr-0">{renderQuestionWithTranslate(`${index + 1}. ${statement}`, statement, props.rawTranslate)}</div>
            <div className="flex gap-2 max-lg:w-full max-lg:justify-stretch max-sm:flex-col max-sm:items-stretch max-sm:justify-center">
              <button
                className={cx(
                  'min-w-[60px] cursor-pointer rounded-md border border-black/20 bg-white/90 px-4 py-1.5 text-[13px] text-[#333] transition-all duration-200 hover:border-[rgba(120,119,198,0.5)] hover:bg-[rgba(120,119,198,0.1)]',
                  'max-lg:h-12 max-lg:flex-1 max-lg:rounded-3xl max-lg:border-black max-lg:bg-transparent max-lg:text-[15px]',
                  exercise.answers[index] === true && 'border-[rgba(120,119,198,0.6)] bg-[rgba(120,119,198,0.2)] max-lg:border-black max-lg:bg-black max-lg:text-white',
                )}
                onClick={() => exercise.onAnswerChange(index, true)}
              >
                True
              </button>
              <button
                className={cx(
                  'min-w-[60px] cursor-pointer rounded-md border border-black/20 bg-white/90 px-4 py-1.5 text-[13px] text-[#333] transition-all duration-200 hover:border-[rgba(120,119,198,0.5)] hover:bg-[rgba(120,119,198,0.1)]',
                  'max-lg:h-12 max-lg:flex-1 max-lg:rounded-3xl max-lg:border-black max-lg:bg-transparent max-lg:text-[15px]',
                  exercise.answers[index] === false && 'border-[rgba(120,119,198,0.6)] bg-[rgba(120,119,198,0.2)] max-lg:border-black max-lg:bg-black max-lg:text-white',
                )}
                onClick={() => exercise.onAnswerChange(index, false)}
              >
                False
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );

  const renderMultipleChoice = (exercise: MultipleChoiceExercise) => (
    <div className="flex flex-col gap-5 after:block after:h-6 after:content-['']">
      {renderInstructionBox()}
      {exercise.exercises.map((ex, index) => {
        const mcCorrect = props.submitted && exercise.answers[index] === exercise.solutions[index];
        const mcIncorrect = props.submitted && !mcCorrect;
        return (
        <div
          key={index}
          className={cx(
            'rounded-lg border border-black/10 bg-white/50 p-4',
            'max-lg:mb-5 max-lg:rounded-3xl max-lg:border-black/5 max-lg:bg-white/80 max-lg:p-3 max-lg:shadow-[0_4px_12px_rgba(0,0,0,0.03)]',
            mcCorrect && 'border-emerald-500/70 max-lg:border-emerald-500/70 max-lg:shadow-[0_0_0_2px_rgba(16,185,129,0.15)]',
            mcIncorrect && 'border-red-500/70 max-lg:border-red-500/70 max-lg:shadow-[0_0_0_2px_rgba(239,68,68,0.12)]',
          )}
        >
          <div className="mb-3 text-sm font-medium text-[#333]">
            {renderQuestionWithTranslate(
              `${index + 1}. ${ex.question}`,
              fillBlanksForTranslate(
                ex.question,
                ex.options[exercise.solutions[index]] ?? ''
              ),
              true
            )}
          </div>
          <div className="flex flex-col gap-2">
            {ex.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                className={cx(
                  'cursor-pointer rounded-md border border-black/20 bg-white/90 px-4 py-2.5 text-left text-[13px] text-[#333] transition-all duration-200 hover:border-[rgba(120,119,198,0.5)] hover:bg-[rgba(120,119,198,0.1)]',
                  'max-lg:flex max-lg:items-center max-lg:rounded-2xl max-lg:border-black/10 max-lg:bg-white/50 max-lg:p-3.5 max-lg:text-[15px]',
                  exercise.answers[index] === optionIndex && 'border-[rgba(120,119,198,0.6)] bg-[rgba(120,119,198,0.2)] max-lg:border-black max-lg:bg-white max-lg:font-semibold max-lg:text-black',
                )}
                onClick={() => exercise.onAnswerChange(index, optionIndex)}
              >
                {String.fromCharCode(97 + optionIndex)}) {option}
              </button>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );

  const renderSentenceBuilding = (exercise: SentenceBuildingExercise) => {
    return (
      <div>
        {renderInstructionBox()}
        <table className={EXERCISE_TABLE}>
          <tbody>
            {exercise.prompts.map((prompt, index) => {
              const inputCorrect = props.submitted && textAnswerMatches(exercise.answers[index], exercise.solutions[index]);
              const inputIncorrect = props.submitted && !inputCorrect;
              return (
              <tr
                key={index}
                className={cx(
                  EXERCISE_ROW,
                  inputCorrect && CORRECT_ROW,
                  inputIncorrect && INCORRECT_ROW,
                )}
              >
                <td className={QUESTION_CELL}>
                  <div className="rounded-md border border-black/10 bg-[rgba(248,249,250,0.8)] p-2 px-3 font-mono text-[13px] text-[#555]">
                    {renderQuestionWithTranslate(
                      prompt,
                      firstCanonicalSolution(exercise.solutions[index]),
                      true
                    )}
                  </div>
                </td>
                <td className={ANSWER_CELL}>
                  <input
                    type="text"
                    className={cx(
                      EXERCISE_INPUT,
                      inputCorrect && CORRECT_INPUT,
                      inputIncorrect && INCORRECT_INPUT,
                    )}
                    value={exercise.answers[index]}
                    onChange={(e) => exercise.onAnswerChange(index, e.target.value)}
                    placeholder="Build your sentence..."
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderWordOrder = (exercise: WordOrderExercise) => (
    <div className="flex flex-col gap-3 after:block after:h-6 after:content-['']">
      {renderInstructionBox()}
      {exercise.jumbledWords.map((words, index) => (
        <WordOrderRow
          key={index}
          words={words}
          index={index}
          answer={exercise.answers[index] ?? ''}
          solution={exercise.solutions[index]}
          submitted={props.submitted}
          onAnswerChange={exercise.onAnswerChange}
          onTranslate={props.onTranslate}
        />
      ))}
    </div>
  );

  const renderExerciseContent = () => {
    switch (props.type) {
      case 'FILL_IN_THE_BLANK_READING_WRITING':
        return renderFillInBlank(props as unknown as FillInBlankExercise);
      case 'TRUE_FALSE_READING':
        return renderTrueFalse(props as unknown as TrueFalseExercise);
      case 'MULTIPLE_CHOICE_READING':
        return renderMultipleChoice(props as unknown as MultipleChoiceExercise);
      case 'SENTENCE_BUILDING_WRITING':
        return renderSentenceBuilding(props as unknown as SentenceBuildingExercise);
      case 'WORD_ORDER_WRITING':
        return renderWordOrder(props as unknown as WordOrderExercise);
      default:
        return null;
    }
  };

  return (
    <div className={EXERCISES_ROOT}>
      {renderExerciseContent()}
    </div>
  );
};
